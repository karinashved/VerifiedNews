const searchBtn = document.getElementById("searchBtn");
const articlesContainer = document.getElementById("articles");

searchBtn.addEventListener("click", async () => {
    const endpoint = document.getElementById("endpoint").value;
    const q = document.getElementById("query").value;
    const language = document.getElementById("language").value;
    const country = document.getElementById("country").value;
    const category = document.getElementById("category").value;
    const from = document.getElementById("from").value;
    const to = document.getElementById("to").value;
    const page_size = document.getElementById("page_size").value;

    let url = `http://localhost:8000/news/${endpoint}?page_size=${page_size}`;
    if (q) url += `&q=${encodeURIComponent(q)}`;
    if (language) url += `&language=${language}`;
    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;
    if (endpoint === "top-headlines") {
        if (country) url += `&country=${country}`;
        if (category) url += `&category=${category}`;
    }

    articlesContainer.innerHTML = "<p>Loading...</p>";

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === "error") {
            articlesContainer.innerHTML = `<p style="color:red;">Error: ${data.message}</p>`;
            return;
        }

        if (!data.articles || data.articles.length === 0) {
            articlesContainer.innerHTML = "<p>No articles found.</p>";
            return;
        }

        articlesContainer.innerHTML = "";
        data.articles.forEach(article => {
            const articleDiv = document.createElement("div");
            articleDiv.classList.add("article", "clearfix");

            let img = "";
            if (article.urlToImage) {
                img = `<img src="${article.urlToImage}" alt="image">`;
            }

            const publishedDate = article.publishedAt 
                ? new Date(article.publishedAt).toLocaleString() 
                : "";

            articleDiv.innerHTML = `
                ${img}
                <a href="${article.url}" target="_blank">${article.title}</a>
                <p><strong>Source:</strong> ${article.source.name} | <strong>Date:</strong> ${publishedDate}</p>
                <p>${article.description || ""}</p>
            `;
            articlesContainer.appendChild(articleDiv);
        });
    } catch (err) {
        articlesContainer.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
    }
});
