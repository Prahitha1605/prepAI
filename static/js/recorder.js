let mediaRecorder;
let recordedChunks = [];
let videoStream;
let questions = [];
let currentQuestionIndex = 0;
let recordingTimer;
let timeElapsed = 0;
let selectedMimeType = "video/webm";

async function fetchQuestions(careerInfo) {
    console.log("fetchQuestions started with careerInfo:", careerInfo);
    // Reset uploadedVideoPaths for new session
    localStorage.setItem("uploadedVideoPaths", JSON.stringify([]));
    console.log("Reset uploadedVideoPaths in localStorage");
    const storedQuestions = localStorage.getItem("questions");
    if (storedQuestions) {
        questions = JSON.parse(storedQuestions).slice(0, 5);
        console.log("Loaded from localStorage:", questions);
    } else {
        try {
            console.log("Fetching from server...");
            const response = await fetch("/generate_questions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ career_info: careerInfo }),
            });
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
            const data = await response.json();
            console.log("Questions received:", data.questions);
            if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
                questions = data.questions.slice(0, 5);
                localStorage.setItem("questions", JSON.stringify(questions));
                console.log("Assigned questions:", questions);
            } else {
                console.log("No valid questions");
                document.getElementById("question-text").innerText = "No questions generated.";
                return;
            }
        } catch (error) {
            console.error("Fetch error:", error);
            document.getElementById("question-text").innerText = `Error: ${error.message}`;
            return;
        }
    }
    console.log("Calling displayQuestion with index 0");
    displayQuestion(0);
}

function displayQuestion(index) {
    console.log("displayQuestion called with index:", index);
    const questionText = document.getElementById("question-text");
    const progressText = document.getElementById("progressText");
    const progressBar = document.getElementById("progressBar");

    if (!questionText) {
        console.error("question-text not found");
        return;
    }
    if (!progressText || !progressBar) {
        console.warn("Progress elements missing, skipping progress update");
    }

    console.log("Current question:", questions[index] || "undefined");
    if (index < questions.length) {
        questionText.innerText = `${index + 1}. ${questions[index] || "Question missing"}`;
        if (progressText) progressText.innerText = `${index} of ${questions.length} questions completed`;
        if (progressBar) progressBar.value = (index / questions.length) * 100;
        const nextBtn = document.getElementById("nextQuestion");
        const submitBtn = document.getElementById("submitBtn");
        if (nextBtn) nextBtn.style.display = "none";
        if (submitBtn) {
            submitBtn.style.display = "none";
            console.log(`submitBtn hidden for question ${index + 1}`);
        }
    } else {
        questionText.innerText = "✅ All questions completed!";
        if (progressText) progressText.innerText = `${questions.length} of ${questions.length} questions completed`;
        if (progressBar) progressBar.value = 100;
        const submitBtn = document.getElementById("submitBtn");
        if (submitBtn) {
            submitBtn.style.display = "inline-block";
            console.log("submitBtn shown after all questions completed");
        }
    }
    console.log("UI updated to:", questionText.innerText);
}

async function startRecording() {
    try {
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
            try {
                videoStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: { deviceId: { ideal: 'default' } }
                });
                break;
            } catch (error) {
                console.error(`Attempt ${attempts + 1} failed:`, error);
                attempts++;
                if (attempts === maxAttempts) {
                    alert("Failed to access webcam/microphone after multiple attempts. Please check permissions.");
                    return;
                }
            }
        }

        console.log("Video tracks:", videoStream.getVideoTracks());
        const audioTracks = videoStream.getAudioTracks();
        console.log("Audio tracks:", audioTracks);
        if (audioTracks.length === 0) {
            alert("No audio tracks detected. Please connect a microphone.");
            return;
        }
        audioTracks.forEach(track => {
            console.log("Audio track details:", {
                id: track.id,
                label: track.label,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState
            });
            track.enabled = true;
            track.onmute = () => {
                console.warn("Audio track muted:", track.label);
                alert("Microphone muted during recording! Please check your microphone settings.");
            };
            track.onunmute = () => console.log("Audio track unmuted:", track.label);
        });
        if (audioTracks[0].muted || !audioTracks[0].enabled) {
            console.warn("Audio track validation failed:", {
                muted: audioTracks[0].muted,
                enabled: audioTracks[0].enabled
            });
            alert("Audio track is muted or disabled, but proceeding with recording to test audio capture.");
        }

        const videoElement = document.getElementById("video");
        videoElement.srcObject = videoStream;
        videoElement.muted = true;
        console.log("Video element muted to prevent feedback");

        const mimeTypes = [
            "video/webm;codecs=vp8,opus",
            "video/webm;codecs=vp9,opus",
            "video/webm",
            "video/mp4"
        ];
        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                selectedMimeType = mimeType;
                break;
            }
        }
        console.log("Selected mimeType:", selectedMimeType);
        mediaRecorder = new MediaRecorder(videoStream, { mimeType: selectedMimeType, audioBitsPerSecond: 128000 });
        recordedChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) recordedChunks.push(event.data);
            console.log("Data available:", event.data.size, "bytes");
        };

        mediaRecorder.start();
        startAudioLevelIndicator();
        startTimer();
        document.getElementById("startRecording").disabled = true;
        document.getElementById("stopRecording").disabled = false;
    } catch (error) {
        console.error("Error accessing webcam/microphone:", error.name, error.message);
        const errorMsg = document.getElementById("error-message");
        if (errorMsg) {
            errorMsg.innerText = `Error: ${error.message}`;
            errorMsg.style.display = "block";
        }
    }
}

function startAudioLevelIndicator() {
    try {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(videoStream);
        microphone.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const canvas = document.createElement("canvas");
        canvas.width = 100;
        canvas.height = 20;
        canvas.style.marginTop = "10px";
        document.getElementById("webcam-container").appendChild(canvas);
        const ctx = canvas.getContext("2d");

        function updateLevel() {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((sum, val) => sum + val, 0) / bufferLength;
            ctx.fillStyle = average > 10 ? "green" : "red";
            ctx.fillRect(0, 0, average, 20);
            console.log("Audio level:", average);
            requestAnimationFrame(updateLevel);
        }
        updateLevel();
    } catch (error) {
        console.error("Audio level indicator failed:", error);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.onstop = async () => {
            const blob = new Blob(recordedChunks, { type: selectedMimeType });
            console.log("Blob created:", blob.size, "Type:", blob.type);
            const audioTracks = videoStream.getAudioTracks();
            audioTracks.forEach(track => {
                console.log("Final audio track state:", {
                    id: track.id,
                    label: track.label,
                    enabled: track.enabled,
                    muted: track.muted,
                    readyState: track.readyState
                });
            });
            try {
                const audioContext = new AudioContext();
                const arrayBuffer = await blob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                const hasAudio = audioBuffer.numberOfChannels > 0 && audioBuffer.duration > 0;
                let isSilent = true;
                for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                    const channelData = audioBuffer.getChannelData(channel);
                    for (let i = 0; i < channelData.length; i++) {
                        if (Math.abs(channelData[i]) > 0.0001) {
                            isSilent = false;
                            break;
                        }
                    }
                    if (!isSilent) break;
                }
                console.log("Audio detected:", hasAudio, "Non-silent:", !isSilent, "Duration:", audioBuffer.duration);
                if (!hasAudio || isSilent) {
                    alert("No audible audio detected in recording. Please check your microphone and try again.");
                    return;
                }
            } catch (error) {
                console.error("Audio detection failed:", error);
            }
            const videoElement = document.getElementById("video");
            videoElement.muted = false;
            console.log("Video element unmuted after recording");
            await uploadvideo();
            const submitBtn = document.getElementById("submitBtn");
            if (submitBtn && currentQuestionIndex >= questions.length - 1) {
                submitBtn.style.display = "inline-block";
                console.log("submitBtn shown after recording last question");
            }
        };
        mediaRecorder.stop();
    }
    if (videoStream) videoStream.getTracks().forEach((track) => track.stop());
    clearInterval(recordingTimer);

    document.getElementById("stopRecording").disabled = true;
    const nextBtn = document.getElementById("nextQuestion");
    const submitBtn = document.getElementById("submitBtn");
    if (nextBtn) {
        nextBtn.style.display = "inline-block";
        console.log("nextBtn shown after stopping recording");
    }
    if (submitBtn) {
        submitBtn.style.display = currentQuestionIndex >= questions.length - 1 ? "inline-block" : "none";
        console.log(`submitBtn display set to ${submitBtn.style.display} for currentQuestionIndex=${currentQuestionIndex}`);
    }
}

function startTimer() {
    timeElapsed = 0;
    recordingTimer = setInterval(() => {
        timeElapsed++;
        const timer = document.getElementById("timer");
        if (timer) timer.innerText = `⏱️ Recording: ${timeElapsed} sec`;
    }, 1000);
}

function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        displayQuestion(currentQuestionIndex);
        const progressBar = document.getElementById("progressBar");
        if (progressBar) progressBar.value = (currentQuestionIndex / questions.length) * 100;
        document.getElementById("startRecording").disabled = false;
        document.getElementById("stopRecording").disabled = true;
        const nextBtn = document.getElementById("nextQuestion");
        if (nextBtn) {
            nextBtn.style.display = "none";
            console.log("nextBtn hidden after moving to next question");
        }
        const timer = document.getElementById("timer");
        if (timer) timer.innerText = "";
        const submitBtn = document.getElementById("submitBtn");
        if (submitBtn) {
            submitBtn.style.display = currentQuestionIndex >= questions.length - 1 ? "inline-block" : "none";
            console.log(`submitBtn display set to ${submitBtn.style.display} after nextQuestion`);
        }
    } else {
        displayQuestion(questions.length);
        const submitBtn = document.getElementById("submitBtn");
        if (submitBtn) {
            submitBtn.style.display = "inline-block";
            console.log("submitBtn shown after all questions via nextQuestion");
        }
    }
}

async function uploadvideo() {
    const blob = new Blob(recordedChunks, { type: selectedMimeType });
    const extension = selectedMimeType.includes("mp4") ? "mp4" : "webm";
    const filename = `response_${Date.now()}.${extension}`;
    const formData = new FormData();
    formData.append("video", blob, filename);
    console.log("Uploading file:", filename, "Size:", blob.size);

    try {
        const response = await fetch("/uploadvideo", {
            method: "POST",
            body: formData,
        });
        const data = await response.json();
        console.log("Upload response:", data, "Status:", response.status);
        if (response.ok && data.file_path) {
            let uploadedPaths = JSON.parse(localStorage.getItem("uploadedVideoPaths") || "[]");
            uploadedPaths.push(data.file_path);
            localStorage.setItem("uploadedVideoPaths", JSON.stringify(uploadedPaths));
            console.log("Stored file path in localStorage:", data.file_path);
        } else {
            console.error("Upload failed:", data);
            alert(`Failed to upload video: ${data.error || "Unknown error"}`);
        }
    } catch (error) {
        console.error("Video upload failed:", error);
        alert(`Failed to upload video: ${error.message}`);
    }
}

async function testAudioOnly() {
    try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Audio-only tracks:", audioStream.getAudioTracks());
        audioStream.getAudioTracks().forEach(track => {
            console.log("Track:", { muted: track.muted, enabled: track.enabled });
        });
        const recorder = new MediaRecorder(audioStream, { mimeType: "audio/webm" });
        let chunks = [];
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: "audio/webm" });
            console.log("Test audio blob created:", blob.size, "Type:", blob.type);
        };
        recorder.start();
        setTimeout(() => {
            recorder.stop();
            audioStream.getTracks().forEach(track => track.stop());
        }, 5000);
    } catch (error) {
        console.error("Audio-only test failed:", error);
    }
}

window.onload = async function () {
    console.log("recorder.js loaded");
    const careerInfo = localStorage.getItem("careerInfo") || "software engineer";
    console.log("Starting fetchQuestions with careerInfo:", careerInfo);
    await fetchQuestions(careerInfo);
    console.log("fetchQuestions completed");
};