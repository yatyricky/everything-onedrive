const child_process = require("child_process")
const fs = require("fs")
const path = require("path")

// config
const { fpEs, fpFetch, interval, maxResult } = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")).toString())
let fpQuery = path.join(fpFetch, "query.txt")
let fpResult = path.join(fpFetch, "result.txt")
let fpMove = path.join(fpFetch, "move.txt")

async function waitForSeconds(s) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, Math.floor(s * 1000));
    })
}

function padWithLeadingZeroes(n, d) {
    let s = "" + n
    let len = s.length
    while (len < d) {
        s = "0" + s
        len++
    }
    return s
}

async function program() {
    while (true) {
        try {
            if (fs.existsSync(fpQuery)) {
                let qs = fs.readFileSync(fpQuery, "utf8")
                child_process.execSync(`${fpEs} "${qs}" -sort-date-modified-descending -max-results ${maxResult} -export-txt out.txt`)
                let lines = fs.readFileSync("out.txt", "utf8").split("\n").map(e => e.trim()).filter(e => {
                    if (!fs.existsSync(e)) {
                        return false
                    }

                    if (!fs.statSync(e).isFile()) {
                        return false
                    }

                    return true
                })
                fs.writeFileSync(fpResult, lines.map((e, i) => `[${padWithLeadingZeroes(i, 4)}] ${e}`).join("\n"))
                fs.unlinkSync(fpQuery)
            }
            if (fs.existsSync(fpMove)) {
                let indices = fs.readFileSync(fpMove, "utf8").split(",").map(e => e.trim()).filter(e => e.length > 0).map(e => parseInt(e))
                let lines = fs.readFileSync(fpResult, "utf8").split("\n")
                for (const index of indices) {
                    let fp = lines[index].substring(7)
                    if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
                        continue
                    }

                    let fpTarget = path.join(fpFetch, path.basename(fp))
                    fs.copyFileSync(fp, fpTarget)
                }

                fs.unlinkSync(fpMove)
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
