const child_process = require("child_process")
const fs = require("fs")
const path = require("path")

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// config
let config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")).toString())
const host = config.host
const submitPassword = config.submitPassword
const fpEs = config.fpEs
const fpFetch = config.fpFetch
const maxFetch = config.maxFetch
const interval = config.interval
// end config

async function waitForSeconds(s) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, Math.floor(s * 1000));
    })
}

const TASK_NONE = 1001
const TASK_QUERY = 1002
const TASK_QUERY_SENT = 1003
const TASK_COPY = 1004
const TASK_COPY_SENT = 1005

let lines = []

async function program() {
    while (true) {
        try {
            let task = await fetch(`${host}/getTask`, {
                headers: new Headers({ "Content-Type": "application/json" }),
                method: "POST",
                body: JSON.stringify({ f1: submitPassword })
            })
            let resp = await task.json()
            console.log("Got resp", resp);
            if (!resp.success) {
                throw new Error(resp.reason)
            }

            switch (resp.status) {
                case TASK_QUERY:
                    child_process.execSync(`${fpEs} ${resp.qs} -sort-date-modified-descending -export-txt out.txt`)
                    lines = fs.readFileSync("out.txt", "utf8").split("\n").map(e => e.trim()).filter(e => {
                        if (!fs.existsSync(e)) {
                            return false
                        }
                        if (!fs.statSync(e).isFile()) {
                            return false
                        }
                        return true
                    })
                    await fetch(`${host}/postResult`, {
                        headers: new Headers({ "Content-Type": "application/json" }),
                        method: "POST",
                        body: JSON.stringify({ f1: submitPassword, everything: lines })
                    })
                    break;
                case TASK_COPY:
                    let fp = lines[resp.copy]
                    if (!fs.existsSync(fp)) {
                        throw new Error(`File not found ${fp}`)
                    }
                    let fpTarget = path.join(fpFetch, path.basename(fp))
                    if (fs.existsSync(fpTarget)) {
                        throw new Error(`File already exists ${fp}`)
                    }
                    if (fs.readdirSync(fpFetch).length > maxFetch) {
                        throw new Error(`Max fetch files reached`)
                    }
                    fs.copyFileSync(fp, path.join(fpFetch, path.basename(fp)))
                    await fetch(`${host}/copyResult`, {
                        headers: new Headers({ "Content-Type": "application/json" }),
                        method: "POST",
                        body: JSON.stringify({ f1: submitPassword })
                    })
                    break;

                default:
                    break;
            }
        } catch (error) {
            console.log(error.message);
        }

        await waitForSeconds(interval)
    }
}

program().catch(err => {
    console.log(err.message);
})