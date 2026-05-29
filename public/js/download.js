
import { settings } from "/public/js/lookup.js"

const button = document.getElementById("downloadBtn")
const table = document.getElementById("tableContainer")

button.addEventListener("click", async () => {
    const width = 1400

    const ogStyles = {
        width: table.style.width,
        transform: table.style.transform,
        transformOrigin: table.style.transformOrigin
    }

    table.style.width = `${width}px`
    table.style.transform = "scale(1)"
    table.style.transformOrigin = "top left"

    await new Promise(requestAnimationFrame)

    const canvas = await window.html2canvas(table, {
        scale: 1,
        useCORS: true,
        backgroundColor: null
    })

    table.style.width = ogStyles.width
    table.style.transform = ogStyles.transform
    table.style.transformOrigin = ogStyles.transformOrigin

    const image = canvas.toDataURL("image/png")

    const link = document.createElement("a")
    link.href = image
    link.download = `${settings.values.main}_${settings.values.week}_schedule.png`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
})
