import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTs from "eslint-config-next/typescript.js";

function findAndPrint(obj, path) {
  if (!obj) return;
  if (obj.experimentalObjectRestSpread) {
    console.log("Found at:", path);
  }
  if (typeof obj === 'object') {
    for (const key in obj) {
      findAndPrint(obj[key], path + "." + key);
    }
  }
}

nextVitals.forEach((c, i) => findAndPrint(c, "nextVitals[" + i + "]"));
nextTs.forEach((c, i) => findAndPrint(c, "nextTs[" + i + "]"));
