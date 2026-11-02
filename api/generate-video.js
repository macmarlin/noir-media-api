export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { image_url, prompt } = req.body;
  if (!image_url) {
    return res.status(400).json({ error: 'image_url is required' });
  }

  try {
    const response = await fetch("https://replicate.com", {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "luma/dream-machine", 
        input: {
          image: image_url,
          prompt: prompt || "Subtle cinematic movement, rain falling, slow motion"
        }
      })
    });

    const data = await response.json();
    
    let prediction = data;
    while (prediction.status !== "succeeded" && prediction.status !== "failed") {
      await new Promise(resolve => setTimeout(resolve, 4000));
      const check = await fetch(prediction.urls.get, {
        headers: { "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}` }
      });
      prediction = await check.json();
    }

    if (prediction.status === "failed") {
      throw new Error("Video generation failed");
    }

    return res.status(200).json({ video_url: prediction.output });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
