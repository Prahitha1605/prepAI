async function generateQuestions() {
    const careerInfo = document.getElementById("careerInfo").value;
    const response = await fetch("/generate_questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ career_info: careerInfo }),
    });

    const data = await response.json();
    localStorage.setItem("questions", JSON.stringify(data.questions));
    localStorage.setItem("careerInfo", careerInfo);
    window.location.href = "/interview";
}
