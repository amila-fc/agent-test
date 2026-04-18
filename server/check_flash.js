const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function findFlashModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        const flashModels = data.models.filter(m => m.name.includes("flash"));
        console.log(JSON.stringify(flashModels, null, 2));
    } catch (error) {
        console.error("Error listing flash models:", error);
    }
}

findFlashModels();
