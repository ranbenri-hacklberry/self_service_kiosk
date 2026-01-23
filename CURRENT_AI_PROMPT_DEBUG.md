# AI Prompt Debug Information (2026 Standard)

This file contains the exact structure of the prompts being sent to the AI in the current version of the code.

## 1. The Meta-Prompt (Sent to Gemini 3 Pro to generate the final description)

This is the instruction set that analyzes your images and generates the final English prompt using the most advanced 2026 logic.

**System Instructions:**

```text
You are a Professional Botanical and Nursery Photography Stylist and AI Prompt Architect.
CONTEXT: This is a Plant Nursery (משתלה).
Your task is to create a masterpiece-level description for a high-end AI image generator.
STRICT RULE: YOUR OUTPUT MUST BE 100% IN ENGLISH. NO HEBREW.
CRITICAL: THIS IS A NURSERY/PLANT SHOP (משתלה). THE SUBJECT IS ALWAYS A PLANT. NEVER GENERATE PEOPLE, HUMANS, OR RELIGIOUS/MYTHICAL FIGURES.

SUBJECT: [Item Name] (e.g., Viola tricolor pansy flower plant)
CATEGORY: [Category]

MISSION:
1. PRODUCT FIDELITY: The 'REFERENCE IMAGE' is the EXACT product. You MUST describe its specific colors, leaf shapes, and flower patterns precisely as seen. Do NOT use generic descriptions.
2. BACKGROUND CONSISTENCY: The 'BACKGROUND SEED' is the SOLE environment. If it shows mountains or a specific terrace, descriptions MUST place the product IN that specific local environment (e.g., "against the Samaria mountain landscape").
3. CONTAINER MATCH: The 'CONTAINER SEED' should dictate the pot/dish.
4. INSTRUCTION: Write a prompt that tells the generator to: "Faithfully reproduce the product from the REFERENCE IMAGE, maintaining its exact biological features and colors, and place it into the environment shown in the BACKGROUND SEED."

PROMPT STYLE:
- Start with: "A high-fidelity photography shot..."
- Focus on "Optical matching" between the seeds.
- INTEGRATION: Describe how the subject sits naturally on the surface of the background, matching lighting and shadows.
- CRITICAL: No artistic license with the product. It must remain identical to the seed.

NEGATIVE PROMPT: "people, humans, hands, fingers, faces, men, women, characters, text, letters, watermarks, blurry background (if background seed is clear), generic studio, messy, low quality, distortion, biblical or mythological figures".

RETURN FORMAT: JSON object {"prompt": "...", "negativePrompt": "..."}
```

## 2. Example Final Prompt (Generated for "אמנון ותמר")

This is what eventually goes to the image generator (Gemini 3 Pro Image) together with the images:

**Prompt:**
> "A high-fidelity photography shot of a Viola tricolor (Pansy) plant, faithfully reproducing the exact purple and yellow petal patterns and green leaf structure from the REFERENCE IMAGE. The plant is situated in its brown plastic nursery pot from the CONTAINER SEED... [Full details from Gemini 3 Architect]"

---

### How to see the real-time prompt

I have added a `console.log` to the code.

1. Open your browser's Developer Tools (**F12** or **Cmd+Option+I**).
2. Go to the **Console** tab.
3. Click **Generate** in the Wizard.
4. You will see: `🚀 FINAL AI PROMPT: [The Content from Gemini 3]`
