import requests
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Get API key from environment variable
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")

# Correct API URL for Gemini 1.5 Flash
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"

def generate_questions(user_input):
    """
    Generates 5 short, simple mock interview questions based on user input using Gemini API.
    Relies entirely on AI-generated content, no defaults.
    """
    prompt = f"Generate exactly 5 short, simple mock interview questions for a candidate specialized in {user_input}. Do not number them, avoid asterisk (*) symbols, separate each question with a single newline, and ensure no blank lines."

    # Payload structure for Gemini API
    data = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ]
    }

    # Set headers
    headers = {
        "Content-Type": "application/json"
    }

    # Send POST request to Gemini API
    try:
        response = requests.post(GEMINI_URL, headers=headers, json=data)
        response.raise_for_status()  # Raise exception for bad status codes
    except requests.RequestException as e:
        print(f"❌ API request failed: {e}")
        return [f"Error: Unable to connect to Gemini API - {str(e)}"]

    # Process response
    result = response.json()
    print("Raw API response:", result)  # Debug raw response

    if "candidates" in result and result["candidates"]:
        raw_text = result["candidates"][0]["content"]["parts"][0]["text"]
        print("Raw text from API:", raw_text)  # Debug raw text
        
        # Split by newline and filter out empty or whitespace-only lines
        questions = [q.strip() for q in raw_text.split("\n") if q.strip()]
        print("Parsed questions:", questions)  # Debug parsed questions

        # Ensure exactly 5 questions
        if len(questions) < 5:
            print(f"Warning: Only {len(questions)} questions generated, expected 5")
            return questions + [f"Error: Insufficient questions generated ({len(questions)} of 5)"] * (5 - len(questions))
        elif len(questions) > 5:
            print(f"Trimming {len(questions)} questions to 5")
            return questions[:5]
        
        return questions
    else:
        print("Error: No valid content in API response")
        return ["No questions generated. Please try again."]