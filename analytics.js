/* Outbound-click tracking for GA4. Classifies external links so the
   veloiq.dev GA4 property can distinguish free-tier engagement (PyPI,
   GitHub, Docs) from paid-intent signals (IQVigilant, vertical solution
   demos, partner sites) — see conversion taxonomy discussion. */
(function () {
  function classify(href) {
    var link;
    try {
      link = new URL(href, window.location.href);
    } catch (e) {
      return null;
    }
    var host = link.hostname;
    var path = link.pathname;

    if (host.indexOf('iqvigilant.ai') !== -1) {
      return { event: 'click_iqvigilant', params: { link_url: link.href, link_domain: host } };
    }
    if (host.indexOf('pypi.org') !== -1) {
      return { event: 'click_pypi', params: { link_url: link.href, link_domain: host } };
    }
    if (host.indexOf('github.com') !== -1) {
      if (path.indexOf('/docs') !== -1) {
        return { event: 'click_docs', params: { link_url: link.href, link_domain: host } };
      }
      return { event: 'click_github', params: { link_url: link.href, link_domain: host } };
    }
    if (host && host !== window.location.hostname) {
      var slug = path.split('/').filter(Boolean).pop() || host;
      return { event: 'click_solution_demo', params: { link_url: link.href, link_domain: host, solution: slug } };
    }
    return null;
  }

  document.addEventListener('click', function (evt) {
    var link = evt.target.closest ? evt.target.closest('a[href]') : null;
    if (!link) return;
    var hit = classify(link.href);
    if (hit && typeof gtag === 'function') {
      gtag('event', hit.event, hit.params);
    }
  }, true);
})();
