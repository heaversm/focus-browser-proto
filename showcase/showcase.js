// Three-slide carousel: buttons and arrow keys.
const slides = [...document.querySelectorAll(".slide")];
let at = 0;
function show(i) {
  at = (i + slides.length) % slides.length;
  slides.forEach((s, k) => (s.hidden = k !== at));
  document.querySelector(".count").textContent = `${at + 1} / ${slides.length}`;
}
document.querySelector(".prev").addEventListener("click", () => show(at - 1));
document.querySelector(".next").addEventListener("click", () => show(at + 1));
document.addEventListener("keydown", (e) => {
  if (document.activeElement?.tagName === "IFRAME") return;
  if (e.key === "ArrowRight") show(at + 1);
  if (e.key === "ArrowLeft") show(at - 1);
});
