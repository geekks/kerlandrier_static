document.addEventListener('DOMContentLoaded', () => {
    // Reset the month selection on page reload
    const monthSelect = document.getElementById('monthSelect');
    monthSelect.value = "";  // Reset to default

    // Track selected filters globally (only declared once)
    let filters = [];

    // Load default events without filtering by month
    loadEvents(defaultQuery, filters);

    // Event listener for month selection
    monthSelect.addEventListener('change', () => {
        let query = defaultQuery;
        const selectedMonth = monthSelect.value;
        if (selectedMonth) query = updateQueryParams(selectedMonth);
        
        // Pass current filters along with the updated query
        loadEvents(query, filters);
    });

    // Event listeners for filters
    const filterButtons = document.getElementsByClassName('filter');
    for (let i = 0; i < filterButtons.length; i++) {
        filterButtons[i].addEventListener('click', () => {
            const selectedMonth = monthSelect.value;
            let query = defaultQuery;

            // If a month is selected, update query with it
            if (selectedMonth) query = updateQueryParams(selectedMonth);

            // Update filters: Add or remove the filter as necessary
            if (filterButtons[i].classList.contains('selected')) {
                filterButtons[i].classList.remove('selected');
                filters = filters.filter((f) => f !== filterButtons[i].textContent);
            } else {
                filterButtons[i].classList.add('selected');
                filters.push(filterButtons[i].textContent);
            }

            // Load events with both the current query and the updated filters
            loadEvents(query, filters);
        });
    }
});

function updateQueryParams(selectedMonth = "") {
    const [startDate, endDate] = selectedMonth.split(",");
    const paramsURL = new URLSearchParams({
        ...defaultParams,
        "timings[gte]": startDate,
        "timings[lte]": endDate,
    });

    return URL + "?" + paramsURL.toString();
}
