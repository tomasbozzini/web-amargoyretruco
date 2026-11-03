/*
 * Se carga en el <head> antes de pintar la página (script propio: respeta la CSP).
 * La intro del mate se muestra una vez por pestaña: si ya se vio, se oculta
 * antes de que aparezca, así no "parpadea" al recargar.
 */
(function () {
  try {
    if (sessionStorage.getItem('ayr-intro-vista')) {
      document.documentElement.classList.add('sin-intro');
    } else {
      sessionStorage.setItem('ayr-intro-vista', '1');
    }
  } catch (e) {
    /* almacenamiento bloqueado: la intro se muestra igual */
  }
})();
