document.addEventListener("DOMContentLoaded", async function () {
    let layoutIndex = 0;
    let layouts = ["layout1", "layout2", "layout3", "layout4", "layout5"];
    let GEMINI_API_KEY = "";

    async function getApiKey() {
        try {
            const response = await fetch("http://127.0.0.1:8080/get_api_key");
            const data = await response.json();
            GEMINI_API_KEY = data.api_key || "";
        } catch (error) {
            console.error("Error fetching API key:", error);
        }
    }
    await getApiKey();

    function addField(sectionId, inputClass) {
        const section = document.getElementById(sectionId);
        
        // Create wrapper div
        const inputWrapper = document.createElement("div");
        inputWrapper.classList.add("input-wrapper");
        
        // Create input
        const newInput = document.createElement("input");
        newInput.type = "text";
        newInput.className = inputClass;
        newInput.placeholder = {
            "education-section": "Degree, University, Year",
            "experience-section": "Job Title, Company, Years",
            "skills-section": "Skill (e.g., Python, ML)",
            "certifications-section": "Certification Name, Issued By, Year"
        }[sectionId] || "";
        
        // Create remove button
        const removeButton = document.createElement("button");
        removeButton.textContent = "✖";
        removeButton.type = "button";
        removeButton.classList.add("remove-input");
        removeButton.addEventListener("click", function() {
            section.removeChild(inputWrapper);
        });
        
        // Append input and remove button to wrapper
        inputWrapper.appendChild(newInput);
        inputWrapper.appendChild(removeButton);
        
        // Add to section
        section.appendChild(inputWrapper);
    }

    // Attach event listeners to all "Add More" buttons
    document.querySelectorAll('button[onclick^="addField"]').forEach(button => {
        button.addEventListener("click", function() {
            const sectionId = this.getAttribute('onclick').match(/'([^']+)'/)[1];
            const inputClass = this.getAttribute('onclick').match(/', *'([^']+)'/)[1];
            addField(sectionId, inputClass);
        });
    });

    async function refineText(inputText) {
        if (!inputText) return "";
        try {
            const response = await fetch("http://127.0.0.1:8080/ai_refine", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: inputText })
            });
            const data = await response.json();
            return data.refined_text || inputText;
        } catch (error) {
            console.error("Error refining text:", error);
            return inputText;
        }
    }

    document.getElementById("aiGenerate").addEventListener("click", async function() {
        const resumeData = {
            name: document.getElementById("name").value,
            email: document.getElementById("email").value,
            phone: document.getElementById("phone").value,
            address: document.getElementById("address").value,
            education: [...document.querySelectorAll('.education-input')].map(i => i.value.trim()).filter(Boolean),
            experience: [...document.querySelectorAll('.experience-input')].map(i => i.value.trim()).filter(Boolean),
            skills: [...document.querySelectorAll('.skills-input')].map(i => i.value.trim()).filter(Boolean),
            certifications: [...document.querySelectorAll('.certifications-input')].map(i => i.value.trim()).filter(Boolean)
        };

        try {
            const response = await fetch("/enhance-resume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(resumeData)
            });
            
            const data = await response.json();
            
            if (data.enhanced_resume) {
                document.getElementById("resume-output").innerHTML = `
                    <div class="resume-template">
                        <div class="resume-header">
                            <h2>${resumeData.name}</h2>
                            <p>Contact: ${resumeData.email} | ${resumeData.phone} | ${resumeData.address}</p>
                        </div>
                        <div class="resume-body">
                            ${data.enhanced_resume}
                        </div>
                    </div>`;
                
                document.getElementById("downloadResume").style.display = "block";
            } else {
                alert("Enhancement failed: " + (data.error || "Unknown error"));
            }
        } catch (error) {
            console.error("Error enhancing resume:", error);
            alert("Error enhancing resume: " + error.message);
        }
    });

    document.getElementById("downloadResume").addEventListener("click", function() {
        const resumeTemplate = document.querySelector(".resume-template");
        if (resumeTemplate) {
            html2pdf().from(resumeTemplate).save("resume.pdf");
        } else {
            alert("Please generate a resume first.");
        }
    });

    document.getElementById("changeLayout").addEventListener("click", function() {
        const resumeTemplate = document.querySelector(".resume-template");
        if (!resumeTemplate) {
            alert("Please generate a resume first.");
            return;
        }

        // Remove existing layout classes
        layouts.forEach(layout => {
            resumeTemplate.classList.remove(layout);
        });

        // Move to next layout
        layoutIndex = (layoutIndex + 1) % layouts.length;
        resumeTemplate.classList.add(layouts[layoutIndex]);
    });
    function goToDashboard() {
        window.location.href = "/dashboard";  // Flask route to dashboard
    }

    document.getElementById("homeButton").addEventListener("click", goToDashboard);

    const chatbotIcon = document.getElementById("chatbot-icon");
    const chatbotWindow = document.getElementById("chatbot-window");
    const sendButton = document.getElementById("send-btn");
    const userInput = document.getElementById("user-input");
    const chatMessages = document.getElementById("chatbot-messages");

    chatbotWindow.style.display = "none";
    chatbotIcon.addEventListener("click", () => chatbotWindow.style.display = chatbotWindow.style.display === "none" ? "block" : "none");
    sendButton.addEventListener("click", sendMessage);
    userInput.addEventListener("keypress", event => event.key === "Enter" && sendMessage());

    function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;
        chatMessages.innerHTML += `<div class="chat-message user">You: ${message}</div>`;
        userInput.value = "";
        fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message })
        })
        .then(response => response.json())
        .then(data => {
            if (data.response) {
                chatMessages.innerHTML += `<div class="chat-message bot">Bot: ${data.response}</div>`;
            } else {
                chatMessages.innerHTML += `<div class="chat-message bot">Bot: [Error: No response]</div>`;
            }
            chatMessages.scrollTop = chatMessages.scrollHeight;
        })
        .catch(error => {
            console.error("Fetch error:", error);
            chatMessages.innerHTML += `<div class="chat-message bot">Bot: [Server Error]</div>`;
        });
        
    }
});
