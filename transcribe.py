import whisper
import os

# Load model once globally to avoid reloading for each file
model = whisper.load_model("base")

def transcribe_video(video_path):
    """
    Converts video/audio to text using OpenAI's Whisper model.

    Args:
        video_path (str): Path to the recorded interview response.

    Returns:
        str: Transcribed text from the video.
    """
    try:
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"File not found: {video_path}")

        result = model.transcribe(video_path)
        transcript = result.get("text", "").strip()

        if not transcript:
            return "[No speech detected]"

        return transcript
    except Exception as e:
        print(f"Error transcribing {video_path}: {str(e)}")
        return "[Transcription Error]"
