class NotificationManager {
  constructor() {
    this.container = null;
  }

  init() {
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.className = 'notification-container';
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 5000) {
    if (!this.container) this.init();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    const content = document.createElement('div');
    content.className = 'notification-content';
    content.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this.remove(notification));

    notification.appendChild(content);
    notification.appendChild(closeBtn);
    this.container.appendChild(notification);

    if (type !== 'error' && duration > 0) {
      setTimeout(() => this.remove(notification), duration);
    }

    return notification;
  }

  remove(notification) {
    notification.classList.add('removing');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  error(message, duration = 7000) {
    return this.show(message, 'error', duration);
  }

  success(message, duration = 3000) {
    return this.show(message, 'success', duration);
  }

  info(message, duration = 5000) {
    return this.show(message, 'info', duration);
  }

  loading(message) {
    const notification = document.createElement('div');
    notification.className = 'notification notification-loading';

    const spinner = document.createElement('div');
    spinner.className = 'notification-spinner';

    const content = document.createElement('div');
    content.className = 'notification-content';
    content.textContent = message;

    notification.appendChild(spinner);
    notification.appendChild(content);

    if (!this.container) this.init();
    this.container.appendChild(notification);

    return {
      remove: () => this.remove(notification),
      update: (newMessage) => { content.textContent = newMessage; }
    };
  }

  clearAll() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

export const notificationService = new NotificationManager();
