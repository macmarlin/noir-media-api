export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  const { prompt } = req.body || {};
  const token = process.env.REPLICATE_API_TOKEN;

  if (!prompt) {
    return res.status(400).json({
      error: "prompt is required"
    });
  }

  if (!token) {
    return res.status(500).json({
      error: "REPLICATE_API_TOKEN is missing in Vercel Environment Variables"
    });
  }

  try {
    const response = await fetch(
      "https://api.replicate.com/v1/models/luma/ray-3.2/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "wait=60"
        },
        body: JSON.stringify({
          input: {
            prompt: prompt,
            aspect_ratio: "16:9",
            resolution: "720p",
            duration: 10,
            hdr: false,
            loop: false,
            exr_export: false
          }
        })
      }
    );

    const rawResponse = await response.text();

    console.log("Replicate HTTP status:", response.status);
    console.log("Replicate response:", rawResponse);

    let prediction;

    try {
      prediction = JSON.parse(rawResponse);
    } catch (parseError) {
      return res.status(502).json({
        error: "Replicate returned an invalid response",
        status: response.status,
        response: rawResponse.slice(0, 1000)
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        error: "Replicate rejected the video request",
        replicate_status: response.status,
        details: prediction
      });
    }

    let attempts = 0;
    const maxAttempts = 30;

    while (
      (prediction.status === "starting" ||
        prediction.status === "processing") &&
      attempts < maxAttempts
    ) {
      await new Promise((resolve) => {
        setTimeout(resolve, 4000);
      });

      if (!prediction.urls || !prediction.urls.get) {
        return res.status(502).json({
          error: "Replicate did not return a status URL",
          prediction
        });
      }

      const statusResponse = await fetch(prediction.urls.get, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const statusText = await statusResponse.text();

      console.log("Replicate status check:", statusResponse.status);
      console.log("Replicate status response:", statusText);

      try {
        prediction = JSON.parse(statusText);
      } catch (parseError) {
        return res.status(502).json({
          error: "Replicate status response was not valid JSON",
          status: statusResponse.status,
          response: statusText.slice(0, 1000)
        });
      }

      attempts++;
    }

    if (prediction.status === "failed") {
      return res.status(502).json({
        error: "Video generation failed",
        details: prediction.error || prediction
      });
    }

    if (prediction.status === "canceled") {
      return res.status(502).json({
        error: "Video generation was canceled",
        details: prediction
      });
    }

    if (prediction.status !== "succeeded") {
      return res.status(504).json({
        error: "Video generation timed out",
        status: prediction.status,
        prediction_id: prediction.id
      });
    }

    let videoUrl = prediction.output;

    if (Array.isArray(videoUrl)) {
      videoUrl = videoUrl[0];
    }

    if (videoUrl && typeof videoUrl === "object" && videoUrl.url) {
      videoUrl = videoUrl.url;
    }

    if (!videoUrl) {
      return res.status(502).json({
        error: "Replicate succeeded but returned no video URL",
        prediction
      });
    }

    return res.status(200).json({
      status: "succeeded",
      video_url: videoUrl,
      prediction_id: prediction.id
    });
  } catch (error) {
    console.error("Video generation error:", error);

    return res.status(500).json({
      error: error.message || "Internal Server Error"
    });
  }
}
