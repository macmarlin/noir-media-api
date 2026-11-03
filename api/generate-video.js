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
      error: "REPLICATE_API_TOKEN is missing"
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
            prompt,
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

    let prediction = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: prediction.detail || "Replicate request failed",
        replicate: prediction
      });
    }

    let attempts = 0;

    while (
      (prediction.status === "starting" ||
        prediction.status === "processing") &&
      attempts < 30
    ) {
      await new Promise((resolve) => setTimeout(resolve, 4000));

      const statusResponse = await fetch(prediction.urls.get, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      prediction = await statusResponse.json();
      attempts++;
    }

    if (prediction.status === "failed") {
      return res.status(500).json({
        error: prediction.error || "Video generation failed"
      });
    }

    if (prediction.status !== "succeeded") {
      return res.status(202).json({
        status: prediction.status,
        prediction_id: prediction.id,
        message: "Video generation is still processing"
      });
    }

    const videoUrl = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;

    return res.status(200).json({
      video_url: videoUrl,
      status: "succeeded"
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Internal Server Error"
    });
  }
}
