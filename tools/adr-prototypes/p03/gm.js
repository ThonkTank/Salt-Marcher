setInterval(() => {
  const ticks = document.querySelector("#ticks");
  ticks.value = String(Number(ticks.value) + 1);
}, 25);
