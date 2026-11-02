export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const response = await fetch("https://replicate.com", {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "suno-ai/flux-1-schnell",
        input: {
          prompt: prompt,
          aspect_ratio: "16:9",
          output_format: "png"
        }
      })
    });

    const data = await response.json();
    
    let prediction = data;
    while (prediction.status !== "succeeded" && prediction.status !== "failed") {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const check = await fetch(prediction.urls.get, {
        headers: { "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}` }
      });
      prediction = await check.json();
    }

    if (prediction.status === "failed") {
      throw new Error("AI generation failed");
    }

    return res.status(200).json({ image_url: prediction.output });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
