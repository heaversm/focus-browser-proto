// The pages the hike demo would show in its site panel, picked to cover the
// likely ways framing fails. See PLAN.md, "Test 1: the site panel".
export const SITES = [
  { name: "NPS conditions", url: "https://www.nps.gov/romo/planyourvisit/conditions.htm", why: "no framing headers" },
  { name: "Colorado Parks", url: "https://cpw.state.co.us/state-parks/eldorado-canyon-state-park", why: "X-Frame-Options" },
  { name: "Boulder OSMP", url: "https://bouldercolorado.gov/trail/royal-arch", why: "X-Frame-Options" },
  { name: "Hiking Project", url: "https://www.hikingproject.com/trail/7000130/royal-arch", why: "redirect + X-Frame-Options" },
  { name: "NWS forecast", url: "https://forecast.weather.gov/MapClick.php?lat=39.93&lon=-105.29", why: "strict CSP" },
  { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Flatirons", why: "strict script policy" },
  { name: "AllTrails", url: "https://www.alltrails.com/trail/us/colorado/royal-arch-trail", why: "bot protection" },
];
