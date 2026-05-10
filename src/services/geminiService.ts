import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Property {
  Property_ID: string;
  Name: string;
  Location: string;
  Price: number;
  Size_sqft: number;
  BHK: number;
  Amenities: string;
  Distance_to_Transit: number;
}

export async function chatWithAssistant(userMessage: string, listingsCsv: string) {
  const systemInstruction = `
You are a Helpful Real Estate Assistant for the National Capital Region (NCR - Delhi, Gurgaon, Noida).

DATABASE (NCR PROPERTIES):
${listingsCsv}

BEHAVIOR:
1. **Validation**: If the user asks for a region outside NCR or speaks nonsense, politely say: "I specialize in NCR (Delhi, Gurgaon, Noida). Please specify your budget and preferred NCR location."
2. **Pricing**: When listing prices, always use the prefix "Starts from".
3. **Currency**: Ensure prices are mentioned in ₹ (Indian Rupees) as per the database.

STRICT OUTPUT FORMAT:
1. **Search Summary**: A brief, professional opening.

2. **The Listings**: For every matched property, you MUST output this EXACT tag (it will be rendered as a card):
[PROPERTY_CARD: Name | ID | Price | Size_sqft | BHK | Transit_Dist | Amenities | Insight]

3. **Market Comparison**:
[CRITICAL: Suround the table with double blank lines above and below. Ensure the alignment row | :--- | ... is exactly correct.]

| Feature | [Property A Name] | [Property B Name] | [Property C Name] |
| :--- | :--- | :--- | :--- |
| **Monthly Rent** | [Price] | [Price] | [Price] |
| **BHK Layout** | [BHK] BHK | [BHK] BHK | [BHK] BHK |
| **Price / SqFt** | ₹[Price/Size] | ₹[Price/Size] | ₹[Price/Size] |
| **Transit Time** | [Dist]m walk | [Dist]m walk | [Dist]m walk |
| **Prime Feature** | [One Key Amenity] | [One Key Amenity] | [One Key Amenity] |

4. **Verdict**:
#### Final Recommendation: [Name] is recommended because...

BEHAVIORAL RULES:
- The comparison table MUST have "Feature" as the first column.
- List up to 3 top properties as columns in the table.
- Calculate Price/SqFt (Price divided by Size) for the table.
- Always separate the table from other text with blank lines.
- The [PROPERTY_CARD: ...] tag remains mandatory for the main listings.
- Use ₹ symbol for all currency.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userMessage,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2, // Lower temperature for more factual ranking
      },
    });

    return response.text || "I'm sorry, I couldn't process that request.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error: Unable to connect to the AI Assistant. Please check your API key.";
  }
}
