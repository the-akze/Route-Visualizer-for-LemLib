async function fetchVersion() {
    let response = await fetch("https://api.github.com/repos/the-akze/Route-Visualizer-for-Lemlib/tags");
    let jsonData = await response.json();
    if (jsonData.length > 0) {
        return jsonData[0].name;
    }
    else {
        return "";
    }
}


document.addEventListener("DOMContentLoaded", () => {
    fetchVersion().then(version => {
        document.getElementById("version-text").innerText = version;
    }).catch(() => {
        document.getElementById("version-text").innerText = "";
    })
});