/* Outbound-click + key-action tracking for GA4. Classifies links so the
   veloiq.dev GA4 property can distinguish free-tier engagement (PyPI,
   GitHub, Docs) from paid-intent signals: IQVigilant, Advanced Development,
   IQVigilant Enterprise Governance, and per-vertical Solution demos.

   Two tagging mechanisms:
   1. data-gtm-event/-product/-action attributes on a link -- for CTAs whose
      intent can't be inferred from the URL alone (e.g. "Contact Sales" on
      the enterprise-extensions page points at the generic contact.html, but
      we still want to know it came from that page's Contact Sales button).
      Checked first, so an explicit tag always wins over the URL heuristics.
   2. URL-based classification -- for everything else, inferred from
      hostname/path.
*/
(function () {
  function classify(link) {
    var explicitEvent = link.getAttribute('data-gtm-event');
    if (explicitEvent) {
      var params = { link_url: link.href };
      var product = link.getAttribute('data-gtm-product');
      var action = link.getAttribute('data-gtm-action');
      if (product) params.product = product;
      if (action) params.action = action;
      return { event: explicitEvent, params: params };
    }

    var url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (e) {
      return null;
    }
    var host = url.hostname;
    var path = url.pathname;

    if (host.indexOf('iqvigilant.ai') !== -1) {
      return { event: 'click_iqvigilant', params: { link_url: url.href, link_domain: host } };
    }
    if (host.indexOf('pypi.org') !== -1) {
      return { event: 'click_pypi', params: { link_url: url.href, link_domain: host } };
    }
    if (host.indexOf('github.com') !== -1) {
      if (path.indexOf('/docs') !== -1) {
        return { event: 'click_docs', params: { link_url: url.href, link_domain: host } };
      }
      return { event: 'click_github', params: { link_url: url.href, link_domain: host } };
    }
    if (host === window.location.hostname) {
      // Same-site paid-extension pages -- no separate domain to key off of,
      // so match on path instead. Anything else same-site (pricing.html,
      // contact.html, etc.) is left unclassified here.
      if (path.indexOf('/advanced-development.html') !== -1) {
        return { event: 'click_advanced_development', params: { link_url: url.href } };
      }
      if (path.indexOf('/enterprise-extensions') !== -1) {
        return { event: 'click_enterprise_governance', params: { link_url: url.href } };
      }
      return null;
    }
    // Any other external domain: vertical-solution demo sites and partner
    // sites (juicemantics.com, etc.) -- tag with the last path segment as
    // the solution slug so each vertical is queryable individually in GA4.
    var slug = path.split('/').filter(Boolean).pop() || host;
    return { event: 'click_solution_demo', params: { link_url: url.href, link_domain: host, solution: slug } };
  }

  document.addEventListener('click', function (evt) {
    var link = evt.target.closest ? evt.target.closest('a[href]') : null;
    if (!link) return;
    var hit = classify(link);
    if (hit && typeof gtag === 'function') {
      gtag('event', hit.event, hit.params);
    }
  }, true);
})();
