document.addEventListener("DOMContentLoaded", () => {
    const searchBtn = document.getElementById("searchBtn");
    const articlesContainer = document.getElementById("articles");
    const endpointSelect = document.getElementById("endpoint");
    const loader = document.getElementById("loader");

    const topHeadlinesOptions = document.getElementById("top-headlines-options");
    const everythingOptions = document.getElementById("everything-options");

    function toggleOptions() {
        if (endpointSelect.value === "top-headlines") {
            topHeadlinesOptions.style.display = "block";
            everythingOptions.style.display = "none";
        } else {
            topHeadlinesOptions.style.display = "none";
            everythingOptions.style.display = "block";
        }
    }

    toggleOptions();
    endpointSelect.addEventListener("change", toggleOptions);

    searchBtn.addEventListener("click", async () => {
        const endpoint = endpointSelect.value;
        const q = document.getElementById("query").value;
        const language = document.getElementById("language").value;
        const country = document.getElementById("country").value;
        const category = document.getElementById("category").value;
        const from = document.getElementById("from").value;
        const to = document.getElementById("to").value;
        const pageSize = document.getElementById("page_size").value;

        if (endpoint === "everything" && !q) {
            articlesContainer.innerHTML = `<p style="color:red;">A search query is required for the 'Everything' endpoint.</p>`;
            return;
        }

        let url = new URL(`http://localhost:8000/news/${endpoint}`);
        const params = new URLSearchParams();
        params.append("pageSize", pageSize);
        if (q) params.append("q", q);

        if (endpoint === "top-headlines") {
            if (country) params.append("country", country);
            if (category) params.append("category", category);
        } else {
            if (language) params.append("language", language);
            if (from) params.append("from", from);
            if (to) params.append("to", to);
        }
        url.search = params.toString();

        loader.style.display = "block";
        articlesContainer.innerHTML = "";

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

            data.articles.forEach(article => {
                const articleDiv = document.createElement("div");
                articleDiv.classList.add("article");

                let img = "";
                if (article.urlToImage) {
                    img = `<img src="${article.urlToImage}" alt="Article image">`;
                }

                const publishedDate = article.publishedAt
                    ? new Date(article.publishedAt).toLocaleString()
                    : "N/A";

                articleDiv.innerHTML = `
                    ${img}
                    <div class="article-content">
                        <a href="${article.url}" target="_blank">${article.title}</a>
                        <p><strong>Source:</strong> ${article.source.name} | <strong>Date:</strong> ${publishedDate}</p>
                        <p>${article.description || ""}</p>
                    </div>
                `;
                articlesContainer.appendChild(articleDiv);
            });
        } catch (err) {
            articlesContainer.innerHTML = `<p style="color:red;">An error occurred: ${err.message}</p>`;
        } finally {
            loader.style.display = "none";
        }
    });
});
