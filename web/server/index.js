const express = require("express");
const https = require("https");
const path = require("path");
const fs = require("fs");

const app = express();

// config
let config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")).toString())
const port = config.port
const submitPassword = config.submitPassword
const fpKey = config.fpKey
const fpCert = config.fpCert
const machineTimeout = config.machineTimeout
// end config

// Read SSL certificate and key files
const options = {
    key: fs.readFileSync(fpKey),
    cert: fs.readFileSync(fpCert),
};

app.use(express.static(path.join(__dirname, "../node_modules")));
app.use(express.json())

// Create HTTPS server
const server = https.createServer(options, app);

server.listen(port, () => {
    console.log(`App listening on https://localhost:${port}`);
});

const TASK_NONE = 1001
const TASK_QUERY = 1002
const TASK_QUERY_SENT = 1003
const TASK_COPY = 1004
const TASK_COPY_SENT = 1005

let qTask = { status: TASK_NONE, qs: "", ts: 0, res: null, result: [], copy: -1 }

// submit task
app.post("/calculate", (req, res) => {
    let body = req.body || {}
    let f1 = body.f1 || ""
    let f2 = body.f2 || ""
    let n1 = 0
    let n2 = 0
    try {
        n1 = parseFloat(f1) || 0
        n2 = parseFloat(f2) || 0
    } catch (error) {
    }
    let sum = n1 + n2

    console.log("/calculate", body);

    // query submission
    try {
        if (f1 !== submitPassword) {
            throw new Error("alien")
        }

        if (qTask.status !== TASK_NONE) {
            throw new Error(`Task status: ${qTask.status}`)
        }

        let index = body.index
        if (typeof index === "number") {
            // copy
            qTask.status = TASK_COPY
            qTask.copy = index
            qTask.ts = Date.now()
            qTask.res = res
        } else {
            // query
            f2 = f2.replace(/\n/g, "")
            if (f2.length === 0) {
                throw new Error("empty query")
            }

            qTask.status = TASK_QUERY
            qTask.qs = f2
            qTask.ts = Date.now()
            qTask.res = res
        }
    } catch (error) {
        console.log(error.message);
        res.status(200).send({ result: sum })
    }
})

// get task
app.post("/getTask", (req, res) => {
    try {
        let body = req.body || {}
        let f1 = body.f1 || ""

        if (f1 !== submitPassword) {
            throw new Error("alien")
        }

        switch (qTask.status) {
            case TASK_QUERY:
                res.status(200).send({ success: true, status: qTask.status, qs: qTask.qs })
                qTask.status = TASK_QUERY_SENT
                qTask.ts = Date.now()
                break;
            case TASK_COPY:
                res.status(200).send({ success: true, status: qTask.status, copy: qTask.copy })
                qTask.status = TASK_COPY_SENT
                qTask.ts = Date.now()
                break;

            default:
                throw new Error("invalid status")
        }
    } catch (error) {
        console.log(error.message);
        res.status(200).send({ success: false, reason: "" + error.message })
    }
})

// query result
app.post("/postResult", (req, res) => {
    try {
        let body = req.body || {}
        let f1 = body.f1 || ""

        if (f1 !== submitPassword) {
            throw new Error("alien")
        }

        if (!qTask.status === TASK_QUERY_SENT) {
            throw new Error("status is not TASK_QUERY_SENT")
        }

        let everything = body.everything || []
        res.status(200).send({ success: true })
        qTask.status = TASK_NONE

        // everything
        qTask.result = everything
        let html = everything.map((e) => `<p><a>${e}</a></p>`).join("")
        qTask.res.status(200).send({ success: true, result: html })
    } catch (error) {
        console.log(error.message);
        res.status(200).send({ success: false, reason: "" + error })
    }
})

app.post("/copyResult", (req, res) => {
    try {
        let body = req.body || {}
        let f1 = body.f1 || ""

        if (f1 !== submitPassword) {
            throw new Error("alien")
        }

        if (!qTask.status === TASK_COPY_SENT) {
            throw new Error("status is not TASK_COPY_SENT")
        }

        res.status(200).send({ success: true })
        qTask.status = TASK_NONE

        // everything
        qTask.res.status(200).send({ success: true, result: "done" })
    } catch (error) {
        console.log(error.message);
        res.status(200).send({ success: false, reason: "" + error })
    }
})

setInterval(() => {
    if (Date.now() - qTask.ts > machineTimeout) {
        qTask.status = TASK_NONE
        qTask.res.status(200).send({ success: false, result: "-1" })
    }
}, 1000);

// Routes

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/index.html"))
});
