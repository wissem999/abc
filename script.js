function showAnswer(card) {
  card.classList.toggle('revealed');
}

function switchMode(mode, el) {
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const img = document.getElementById('mode-demo-img');
  img.alt = mode.charAt(0).toUpperCase() + mode.slice(1) + ' Mode Demo';
}

function toggleFaq(item) {
  item.classList.toggle('open');
}

document.querySelectorAll('.faq-item').forEach((item, i) => {
  if (i === 0) item.classList.add('open');
});

document.addEventListener('DOMContentLoaded', () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.question-card, .mode-card, .faq-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
});
