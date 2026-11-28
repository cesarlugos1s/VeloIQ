/*
 * Sorting and filtering for the tables of the documentation site's list pages (the home page, the changelog and the traceability views).
 *
 * Which pages: the ones named in window.veloiqSortableTablePages (written when the site is staged by site_tables_config.js): the changelog and the
 * traceability views. The home page is not one of them: its few rows are fixed.
 * Sorting: a click on a column header sorts by it (numbers as numbers, anything else as text), a second click reverses it.
 * Filtering: a table of ten rows or more gets a text box that keeps the rows containing the text, and a list for each column that has only a few values.
 * Self-contained: no library and nothing loaded from the network.
 */
(function () {
  "use strict";

  var MINIMUM_ROWS_TO_SORT = 5;
  var MINIMUM_ROWS_TO_FILTER = 10;
  var MAXIMUM_VALUES_IN_A_COLUMN_LIST = 12;

  function textOf(cell) { return (cell.textContent || "").replace(/\s+/g, " ").trim(); }

  function isNumber(value) { return value === "" || /^-?\d+(\.\d+)?$/.test(value); }

  function compareValues(first, second, numeric) {
    if (numeric) { return (first === "" ? -Infinity : Number(first)) - (second === "" ? -Infinity : Number(second)); }
    return first.localeCompare(second, undefined, { sensitivity: "base", numeric: true });
  }

  function createElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) { element.className = className; }
    if (text !== undefined) { element.textContent = text; }
    return element;
  }

  function enhanceTable(table) {
    if (table.getAttribute("data-site-table") || !table.tHead || !table.tBodies.length || table.tBodies[0].rows.length < MINIMUM_ROWS_TO_SORT) { return; }
    table.setAttribute("data-site-table", "1");
    var headers = Array.prototype.slice.call(table.tHead.rows[0].cells);
    var body = table.tBodies[0];
    var rows = Array.prototype.slice.call(body.rows);
    var texts = rows.map(function (row) { return Array.prototype.slice.call(row.cells).map(textOf); });
    var sortedColumn = -1;
    var sortedDescending = false;
    var columnLists = [];
    var statusLine = null;
    var textFilter = null;

    function applyFilters() {
      var needle = textFilter ? textFilter.value.trim().toLowerCase() : "";
      var shown = 0;
      rows.forEach(function (row, rowIndex) {
        var matches = !needle || texts[rowIndex].join(" ").toLowerCase().indexOf(needle) !== -1;
        columnLists.forEach(function (entry) {
          if (matches && entry.select.value !== "" && texts[rowIndex][entry.column] !== entry.select.value) { matches = false; }
        });
        row.hidden = !matches;
        if (matches) { shown += 1; }
      });
      if (statusLine) { statusLine.textContent = shown + " of " + rows.length + " rows"; }
    }

    function sortBy(column) {
      sortedDescending = sortedColumn === column ? !sortedDescending : false;
      sortedColumn = column;
      var numeric = texts.every(function (cells) { return isNumber(cells[column] || ""); });
      var order = rows.map(function (row, rowIndex) { return rowIndex; });
      order.sort(function (first, second) {
        var result = compareValues(texts[first][column] || "", texts[second][column] || "", numeric);
        return sortedDescending ? -result : result;
      });
      order.forEach(function (rowIndex) { body.appendChild(rows[rowIndex]); });
      headers.forEach(function (header, headerIndex) {
        if (headerIndex === column) { header.setAttribute("aria-sort", sortedDescending ? "descending" : "ascending"); } else { header.removeAttribute("aria-sort"); }
      });
    }

    headers.forEach(function (header, column) {
      header.classList.add("site-table-sortable");
      header.setAttribute("tabindex", "0");
      header.setAttribute("role", "button");
      header.addEventListener("click", function () { sortBy(column); });
      header.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); sortBy(column); }
      });
    });

    if (rows.length < MINIMUM_ROWS_TO_FILTER) { return; }
    var bar = createElement("div", "site-table-filters");
    textFilter = createElement("input", "site-table-filter-text");
    textFilter.type = "search";
    textFilter.placeholder = "Filter rows";
    textFilter.setAttribute("aria-label", "Filter rows");
    textFilter.addEventListener("input", applyFilters);
    bar.appendChild(textFilter);
    headers.forEach(function (header, column) {
      var values = {};
      texts.forEach(function (cells) { values[cells[column] || ""] = true; });
      var distinct = Object.keys(values).sort(function (first, second) { return compareValues(first, second, false); });
      if (distinct.length < 2 || distinct.length > MAXIMUM_VALUES_IN_A_COLUMN_LIST) { return; }
      var select = createElement("select", "site-table-filter-column");
      select.setAttribute("aria-label", "Filter by " + textOf(header));
      select.appendChild(createElement("option", "", textOf(header) + ": all")).value = "";
      distinct.forEach(function (value) { var option = createElement("option", "", value === "" ? "(empty)" : value); option.value = value; select.appendChild(option); });
      select.addEventListener("change", applyFilters);
      columnLists.push({ column: column, select: select });
      bar.appendChild(select);
    });
    var clear = createElement("button", "site-table-filter-clear", "Clear");
    clear.type = "button";
    clear.addEventListener("click", function () {
      textFilter.value = "";
      columnLists.forEach(function (entry) { entry.select.value = ""; });
      applyFilters();
    });
    bar.appendChild(clear);
    statusLine = createElement("span", "site-table-filter-count");
    statusLine.setAttribute("aria-live", "polite");
    bar.appendChild(statusLine);
    var wrapper = table.closest(".md-typeset__scrollwrap") || table;
    wrapper.parentNode.insertBefore(bar, wrapper);
    applyFilters();
  }

  function enhancePage() {
    var pages = window.veloiqSortableTablePages || [];
    var page = decodeURIComponent(window.location.pathname.split("/").pop() || "");
    if (pages.indexOf(page) === -1) { return; }
    Array.prototype.forEach.call(document.querySelectorAll(".md-typeset table"), enhanceTable);
  }

  // Material can swap the page without a reload (instant navigation): its document$ stream then says so.
  if (window.document$ && typeof window.document$.subscribe === "function") { window.document$.subscribe(enhancePage); }
  else if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", enhancePage); }
  else { enhancePage(); }
})();
