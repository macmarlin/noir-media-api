import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  const { prompt } = req.body || {};

  if (!prompt) {
    return res.status(400).json({
      error: "prompt is required"
    });
  }

  try {
    const input = {
      prompt,
      aspect_ratio: "16:9",
      resolution: "720p",
      duration: 10,
      hdr: false,
      loop: false,
      exr_export: false
    };

    const output = await replicate.run("luma/ray-3.2", {
      input
    });

    const videoUrl =
      typeof output?.url === "function"
        ? output.url()
        : Array.isArray(output)
          ? output[0]
          : output;

    return res.status(200).json({
      video_url: videoUrl
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message || "Video generation failed"
    });
  }
}
