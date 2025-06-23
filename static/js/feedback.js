console.log("feedback.js loaded");
let recordedFilePaths = JSON.parse(localStorage.getItem("uploadedVideoPaths") || "[]");

async function submitForFeedback() {
    console.log("submitForFeedback called");
    recordedFilePaths = JSON.parse(localStorage.getItem("uploadedVideoPaths") || "[]");
    console.log("recordedFilePaths:", recordedFilePaths);
    console.log("localStorage.uploadedVideoPaths:", localStorage.getItem("uploadedVideoPaths"));

    if (recordedFilePaths.length === 0) {
        console.log("No file paths found in recordedFilePaths");
        alert("No responses recorded to analyze! Please record at least one response.");
        return;
    }

    try {
        console.log("Sending request to /analyze_responses with file paths:", recordedFilePaths);
        const response = await fetch("/analyze_responses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file_paths: recordedFilePaths }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Analysis failed with status:", response.status, "Error:", errorText);
            throw new Error(`Analysis failed with status ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log("Analysis results:", data.results);
        if (data.status === "error") {
            console.error("Server returned error:", data.message);
            throw new Error(data.message);
        }
        localStorage.setItem("feedback", JSON.stringify(data.results));
        alert("✅ Interview responses analyzed successfully!");
        window.location.href = "/feedback";
    } catch (error) {
        console.error("Error during analysis:", error);
        alert(`❌ Failed to analyze responses: ${error.message}`);
    }
}