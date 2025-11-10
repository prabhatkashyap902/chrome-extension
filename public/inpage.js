(function () {
  console.log("[TTC] inpage.js injected");

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== "TTC_CONTENT") return;

    const { type, payload } = event.data;

    if (type === "TTC_CONNECT_AND_SIGN") {
      try {
        const provider = window?.solana || window?.phantom?.solana;

        if (!provider || !provider.isPhantom) {
          return window.postMessage(
            {
              source: "TTC_INPAGE",
              type: "TTC_CONNECT_AND_SIGN_ERROR",
              error: "Phantom not installed."
            },
            "*"
          );
        }

        // connect
        const { publicKey } = await provider.connect().catch((e) => {
          throw new Error("Connect failed: " + e.message);
        });

        // sign
        const encoder = new TextEncoder();
        const messageBytes = encoder.encode(payload.message);

        let signed;
        try {
          signed = await provider.signMessage(messageBytes);
        } catch (err) {
          throw new Error("signMessage failed: " + err.message);
        }

        const sigBase64 = btoa(String.fromCharCode(...signed.signature));

        window.postMessage(
          {
            source: "TTC_INPAGE",
            type: "TTC_CONNECT_AND_SIGN_DONE",
            payload: {
              publicKey: publicKey.toString(),
              signature: sigBase64
            }
          },
          "*"
        );
      } catch (err) {
        window.postMessage(
          {
            source: "TTC_INPAGE",
            type: "TTC_CONNECT_AND_SIGN_ERROR",
            error: err.message
          },
          "*"
        );
      }
    }
  });
})();
