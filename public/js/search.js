
function fold(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

export function setup(element, placeholder = "search...") {
    if (!element) return
    if (element.dataset.searchable === "true") return

    element.dataset.searchable = "true"
    element.style.display = "none"

    const wrapper = document.createElement("div")
    wrapper.className = "customSelect"

    const input = document.createElement("input")
    input.type = "text"
    input.placeholder = placeholder
    input.autocomplete = "off"
    input.spellcheck = false

    const optionsDiv = document.createElement("div")
    optionsDiv.className = "customOptions"

    wrapper.appendChild(input)
    wrapper.appendChild(optionsDiv)

    element.parentNode.insertBefore(wrapper, element.nextSibling)

    let active = -1

    function visibleOptions() {
        return Array.from(optionsDiv.children).filter(d => !d.hidden)
    }

    function setActive(index) {
        const options = visibleOptions()
        options.forEach(d => d.classList.remove("active"))

        if (!options.length) return active = -1

        active = Math.max(0, Math.min(index, options.length - 1))
        options[active].classList.add("active")
        options[active].scrollIntoView({ block: "nearest" })
    }

    function open() {
        buildOptions()
        filter("")

        optionsDiv.classList.add("open")
        setActive(Array.from(optionsDiv.children).findIndex(d => d.dataset.value === element.value))
    }

    function close() {
        optionsDiv.classList.remove("open")
        active = -1

        syncInput()
    }

    function syncInput() {
        const selected = element.options[element.selectedIndex]
        input.value = selected ? selected.textContent : ""
    }

    function pick(div) {
        if (!div) return

        element.value = div.dataset.value
        element.dispatchEvent(new Event("change"))

        close()
    }

    function filter(text) {
        const query = fold(text.trim())

        Array.from(optionsDiv.children).forEach(div => {
            div.hidden = query !== "" && !div.dataset.search.includes(query)
        })

        setActive(0)
    }

    function buildOptions() {
        optionsDiv.innerHTML = ""

        Array.from(element.options).forEach(option => {
            if (!option.value) return

            const div = document.createElement("div")
            div.textContent = option.textContent
            div.dataset.value = option.value
            div.dataset.search = fold(option.textContent)

            div.addEventListener("mousedown", (e) => {
                e.preventDefault()
                pick(div)
            })

            optionsDiv.appendChild(div)
        })
    }

    buildOptions()
    syncInput()

    const observer = new MutationObserver(() => {
        buildOptions()
        syncInput()
    })
    observer.observe(element, { childList: true })

    input.addEventListener("focus", () => {
        open()
        input.select()
    })

    input.addEventListener("input", () => {
        if (!optionsDiv.classList.contains("open")) optionsDiv.classList.add("open")
        filter(input.value)
    })

    input.addEventListener("keydown", (e) => {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault()
                if (!optionsDiv.classList.contains("open")) return open()
                return setActive(active + 1)

            case "ArrowUp":
                e.preventDefault()
                return setActive(active - 1)

            case "Enter":
                e.preventDefault()
                return pick(visibleOptions()[active])

            case "Escape":
                return close()
        }
    })

    input.addEventListener("blur", () => close())

    element.addEventListener("change", syncInput)
}
