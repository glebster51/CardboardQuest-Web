// This entry has no static imports: it can report a failed application module graph.
(() => {
  function showError(message) {
    document.querySelector('#loading').hidden = true;
    const panel = document.querySelector('#error'); panel.replaceChildren();
    const text = document.createElement('p'); text.textContent = message;
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Повторить загрузку';
    retry.addEventListener('click', () => location.reload());
    panel.append(text, retry); panel.hidden = false;
  }
  addEventListener('cq-start-error', event => showError(event.detail));
  import("./app.js?v=ab782efa5048549c").catch(error => {
    console.error(error);
    showError('Не удалось загрузить игру. Проверь соединение и повтори загрузку.');
  });
})();
