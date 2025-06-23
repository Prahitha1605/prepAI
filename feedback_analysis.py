import requests
import time
import re
from gemini_api import GEMINI_API_KEY, GEMINI_URL

def validate_gemini_config():
    """Validate Gemini API configuration."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set in environment variables")
    if not GEMINI_URL:
        raise ValueError("GEMINI_URL is not set")
    print("Gemini API configuration validated")

def calculate_fallback_score(response_text):
    """Calculate a fallback score based on response content."""
    keywords = ["keras", "tensorflow", "scikit-learn", "pandas", "numpy", "api", "cloud", "deployment", "dashboard", "model"]
    score = 60  # Base score for non-empty response
    for keyword in keywords:
        if keyword.lower() in response_text.lower():
            score += 5  # Increment for relevant ML terms
    return min(score, 90)  # Cap at 90 to allow Gemini to assign higher scores

def analyze_responses(responses):
    """
    Analyzes interview responses using the Gemini API to generate feedback and scores.

    Args:
        responses (list): List of transcribed answers to questions.

    Returns:
        list: Feedback and score for each response in the format:
              [{"question_number": int, "response_text": str, "score": int, "feedback": str}, ...]
    """
    start_time = time.time()
    try:
        validate_gemini_config()
    except ValueError as e:
        print(f"Gemini configuration error: {str(e)}")
        return [{"question_number": i + 1, "response_text": resp, "score": 0, "feedback": f"Configuration error: {str(e)}"} for i, resp in enumerate(responses)]

    print(f"Received {len(responses)} responses for analysis")
    feedback_data = []
    for idx, response_text in enumerate(responses, 1):
        print(f"Analyzing response {idx}: {response_text}")
        if response_text.startswith("[Transcription Error") or response_text == "[No speech detected]":
            print(f"Skipping analysis for invalid response: {response_text}")
            feedback_data.append({
                "question_number": idx,
                "response_text": response_text,
                "score": 0,
                "feedback": (
                    "Score: 0\n"
                    "Clarity: Unable to assess due to transcription error.\n"
                    "Confidence: Unable to assess due to transcription error.\n"
                    "Relevance: Unable to assess due to transcription error.\n"
                    "Suggestions: Ensure clear audio input. Check microphone and file format (.webm). Try re-recording."
                )
            })
            continue

        prompt = (
            f"Evaluate the following interview response for clarity, confidence, and relevance to machine learning/AI topics. Assign a score from 1 to 100 (1=poor, 100=excellent), ensuring relevant content (e.g., mentioning tools like Keras, APIs, or deployment) scores at least 60. Provide concise, balanced feedback (~50 words per section) acknowledging strengths and suggesting improvements. Use this exact format with newlines:\n\n"
            f"Response: '{response_text}'\n\n"
            f"Score: [number from 1 to 100]\n"
            f"Clarity: [explain clarity and structure]\n"
            f"Confidence: [assess delivery and certainty]\n"
            f"Relevance: [evaluate alignment with ML/AI topics]\n"
            f"Suggestions: [specific, actionable improvements with examples]"
        )

        data = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ]
        }

        headers = {
            "Content-Type": "application/json",
            # Try without Authorization header; adjust based on API requirements
            # "Authorization": f"Bearer {GEMINI_API_KEY}"
        }

        try:
            api_start_time = time.time()
            print(f"Sending request to Gemini API for response {idx}")
            api_response = requests.post(GEMINI_URL, headers=headers, json=data, timeout=15)
            api_response.raise_for_status()
            result = api_response.json()
            api_end_time = time.time()
            print(f"Gemini API call for response {idx} took {api_end_time - api_start_time:.2f} seconds")
            print(f"Raw Gemini API response: {result}")

            feedback_text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            if not feedback_text:
                print(f"No valid content in Gemini API response for response {idx}")
                feedback_data.append({
                    "question_number": idx,
                    "response_text": response_text,
                    "score": calculate_fallback_score(response_text),
                    "feedback": (
                        "Score: 0\n"
                        "Clarity: No feedback received from API.\n"
                        "Confidence: No feedback received from API.\n"
                        "Relevance: No feedback received from API.\n"
                        "Suggestions: Check Gemini API configuration and try again."
                    )
                })
                continue

            score = calculate_fallback_score(response_text)
            feedback = feedback_text
            score_match = re.search(r"Score:\s*(\d{1,3})", feedback_text)
            if score_match:
                try:
                    parsed_score = int(score_match.group(1))
                    if 1 <= parsed_score <= 100:
                        score = parsed_score
                    else:
                        print(f"Invalid score {parsed_score} for response {idx}, using fallback: {score}")
                except ValueError as e:
                    print(f"Failed to parse score for response {idx}: {str(e)}, using fallback: {score}")
            else:
                print(f"No Score field in response {idx}, using fallback: {score}")

            feedback_data.append({
                "question_number": idx,
                "response_text": response_text,
                "score": score,
                "feedback": feedback
            })
        except requests.RequestException as e:
            print(f"Error analyzing response {idx}: {str(e)}")
            feedback_data.append({
                "question_number": idx,
                "response_text": response_text,
                "score": calculate_fallback_score(response_text),
                "feedback": (
                    "Score: 0\n"
                    "Clarity: Unable to generate feedback due to API error.\n"
                    "Confidence: Unable to generate feedback due to API error.\n"
                    "Relevance: Unable to generate feedback due to API error.\n"
                    "Suggestions: Check Gemini API key and network connection."
                )
            })

    end_time = time.time()
    print(f"Total analysis took {end_time - start_time:.2f} seconds")
    print(f"Final feedback data: {feedback_data}")
    return feedback_data