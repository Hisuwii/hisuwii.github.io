import "./style.css";
import { initWork } from "./work";
import { initBeforeAfter } from "./ba";
import { initEstimator } from "./estimator";
import { initDetails, initHero, initNav, initReveal, initStats, initTheme } from "./ui";

initTheme();
initDetails();
initStats();
initWork();
initBeforeAfter();
initEstimator();
initReveal();
initNav();
initHero();
document.getElementById("y")!.textContent = String(new Date().getFullYear());
