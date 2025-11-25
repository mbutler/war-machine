type NotificationVariant = "info" | "success" | "warning" | "danger";

interface NotificationOptions {
  title: string;
  message?: string;
  variant?: NotificationVariant;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT = 4500;
let stackElement: HTMLDivElement | null = null;

function ensureStack(): HTMLDivElement {
  if (stackElement) {
    return stackElement;
  }
  stackElement = document.createElement("div");
  stackElement.className = "toast-stack";
  document.body.appendChild(stackElement);
  return stackElement;
}

export function showNotification(options: NotificationOptions) {
  if (typeof window === "undefined") {
    return;
  }

  const stack = ensureStack();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.dataset.variant = options.variant ?? "info";

  const heading = document.createElement("div");
  heading.className = "toast-title";
  heading.textContent = options.title;

  toast.appendChild(heading);

  if (options.message) {
    const copy = document.createElement("div");
    copy.className = "toast-message";
    copy.textContent = options.message;
    toast.appendChild(copy);
  }

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "toast-dismiss";
  dismiss.textContent = "×";
  dismiss.addEventListener("click", () => {
    stack.removeChild(toast);
  });

  toast.appendChild(dismiss);
  stack.appendChild(toast);

  const timeout = window.setTimeout(() => {
    if (toast.parentElement) {
      toast.parentElement.removeChild(toast);
    }
  }, options.timeoutMs ?? DEFAULT_TIMEOUT);

  toast.addEventListener("mouseenter", () => window.clearTimeout(timeout));
  toast.addEventListener("mouseleave", () => {
    window.setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, DEFAULT_TIMEOUT / 2);
  });
}


