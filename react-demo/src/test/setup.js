// Shared jsdom shims. jsdom has no 2D context, no ResizeObserver and no layout,
// so hand LiteGraph and the bench chrome permissive stand-ins.

const context = new Proxy(
    {},
    {
        get: (target, prop) => {
            if (prop in target) return target[prop];
            if (prop === "measureText") return () => ({ width: 10 });
            if (prop === "createLinearGradient" || prop === "createPattern")
                return () => ({ addColorStop() {} });
            if (prop === "getImageData")
                return () => ({ data: new Uint8ClampedArray(4) });
            return () => {};
        },
        set: (target, prop, value) => ((target[prop] = value), true),
    }
);

HTMLCanvasElement.prototype.getContext = () => context;

if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}

if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query) => ({
        matches: false,
        media: query,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        onchange: null,
        dispatchEvent: () => false,
    });
}
