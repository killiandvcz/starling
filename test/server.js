import { Starling } from "$";

const starling = new Starling();

starling.method("token:check", async context => {
    return context.success({
        valid: true,
        user: {
            id: "12345",
            name: "John Doe"
        }
    })
});

starling.on("message:emitted", message => {
    console.log("Message emitted:", message);
});

starling.onconnected(() => {
    starling.request("user:create", {name: "John Doe"}).then(res => {
        console.log("Response", res.data);
    }).catch(err => {
        console.error("Error", err);
    });
});

starling.connect("ws://localhost:3000");