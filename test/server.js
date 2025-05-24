import { Starling } from "$";

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const starlingA = new Starling();
starlingA.method("manifest", async context => {
    console.log("Starling A manifest method called");
    return context.success({
        name: "Starling A",
        version: "1.0.0",
        description: "This is Starling A"
    });
});
starlingA.connect("ws://localhost:3000");
starlingA.onconnected(() => {
    console.log("Starling A connected");
});


const starlingB = new Starling();
starlingB.method("manifest", async context => {
    console.log("Starling B manifest method called");
    
    return context.success({
        name: "Starling B",
        version: "1.0.0",
        description: "This is Starling B"
    });
})
starlingB.connect("ws://localhost:3000");
starlingB.onconnected(() => {
    console.log("Starling B connected");

    wait(5000).then(() => {
        starlingA.request("manifest",{}, {
            peer: {
                name: "Starling B"
            }
        }).then(response => {
            console.log("Starling A received response from Starling B:", response.data);
        });
    })


});

