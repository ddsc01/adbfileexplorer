import './css/index.css';
const { electronAPI } = window;
window.bootstrap = require('bootstrap');

document.addEventListener('DOMContentLoaded', async () => {
    const navBar = document.getElementById('navBar');
    const body = document.getElementsByTagName('body')[0];
    addEventListener("resize", (event) => { checkNavbar(); });

    const connectIPButton = document.getElementById('connect_ip');
    const devicesDiv = document.getElementById('devices');
    const filesDiv = document.getElementById('files');
    const backButton = document.getElementById('backButton');
    const downloadButton = document.getElementById('downloadButton');
    const information = document.getElementById('information');

    let currentDeviceId = null;
    let currentDir = '/sdcard';
    let selectedFiles = [];

    if (!await checkAdb()) {
        information.innerText = 'ADB is not installed. Please install it first.';
        devicesDiv.innerHTML = '<div class="btn btn-outline-danger me-2" id="recheck-adb">Recheck ADB</div>';
        document.getElementById('recheck-adb').addEventListener('click', async () => {
            if(await checkAdb()) {
                await init();
            }
        });
    } else {
        await init();
    }

    async function init() {
        await checkDevices();
        checkNavbar();
        connectIPButton.classList.remove('d-none');
    }

    connectIPButton.addEventListener('click', () => {
        connectIP();
    });

    function connectIP() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'promptModal';
        modal.innerHTML = `<div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">Enter the IP Address of your Device</div>
            <div class="modal-body">
                <input type="text" id="ip-address" name="ip-address" class="form-control">
            </div>
            <div class="modal-footer">
               <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
               <button type="button" class="btn btn-primary" id="okModal">OK</button>
            </div>
        </div>
    </div>`;
        body.appendChild(modal);

        const modalElement = document.getElementById('promptModal');
        const promptModal = new bootstrap.Modal(document.getElementById('promptModal'), {
            keyboard: false
        });

        const doConnect = async (ip) => {
            try {
                await electronAPI.invoke('connect-ip', ip.value);
                await checkDevices();
                promptModal.hide();
            } catch(e) {
                alert("Error connecting IP address, did you enter a valid IP address?\n" + e.message);
            }
        }

        modalElement.addEventListener('shown.bs.modal', () => {
            const ip = document.getElementById('ip-address');
            const okButton = document.getElementById('okModal');
            okButton.addEventListener('click', () => {
                doConnect(ip);
            });
            ip.onkeydown = (e) => {
                if(e.code === 'Enter') {
                    doConnect(ip);
                }
            }
        });
        modalElement.addEventListener('hidden.bs.modal', () => {
            modalElement.remove();
        });
        promptModal.show();
    }

    async function checkAdb() {
        return await electronAPI.invoke('check-adb-installed');
    }

    async function checkDevices() {
        const devices = await electronAPI.invoke('list-devices');
        if (devices.length === 0) {
            information.innerText = 'No device connected. Please connect a device and try again.';
            devicesDiv.innerHTML = '<div class="btn btn-outline-danger me-2" id="recheck-devices">Recheck Devices</div>';
            document.getElementById('recheck-devices').addEventListener('click', (e) => {
                checkDevices();
            });
        } else {
            devicesDiv.innerHTML = devices.map(device => `<button class="device btn btn-outline-warning me-2" data-id="${device.id}"><i class="fa fa-mobile-phone"></i> ${device.id}</button>`).join('<br>');
            const theDevices = document.querySelectorAll('.device');
            theDevices.forEach(button => {
                button.addEventListener('click', async (event) => {
                    currentDeviceId = event.target.dataset.id;
                    await listFiles(currentDir);
                });
            });

            if(theDevices.length === 1) {
                currentDeviceId = theDevices[0].dataset.id;
                await listFiles(currentDir);
            }

            backButton.addEventListener('click', async () => {
                checkSelected(true);
                currentDir = currentDir.split('/').slice(0, -1).join('/') || '/';
                await listFiles(currentDir);
            });

            downloadButton.addEventListener('click', async () => {
                if (selectedFiles.length === 0) {
                    alert('No files selected for download.');
                    return;
                }

                const success = await electronAPI.invoke('download-files', currentDeviceId, currentDir, selectedFiles);
                if (success) {
                    alert('Files downloaded successfully.');
                    const selectedElements = document.querySelectorAll('.file.file-selected');
                    selectedElements.forEach(selectedElement => { selectedElement.classList.remove('file-selected'); });
                } else {
                    alert('Error downloading files.');
                }
            });
        }
    }

    async function listFiles(dir) {
        information.innerText = 'Current directory: ' + dir;

        const files = await electronAPI.invoke('list-files', currentDeviceId, dir);
        let listItems = ['',''];
        files.forEach((file) => {
            const m = file.date;
            const date = m.getUTCFullYear() +"-"+ addZero(m.getUTCMonth()+1) +"-"+ addZero(m.getUTCDate()) + " " + addZero(m.getUTCHours()) + ":" + addZero(m.getUTCMinutes()) + ":" + addZero(m.getUTCSeconds());
            const fileSize = FileSize(file.size)
            const fileInfo = `<div class="col-4">${date} - ${fileSize}</div>`;
            if(file.isDir) {
                listItems[0] += `<div class="row">
                        <div class="col-8 directory" data-name="${file.name}"><i class="fa fa-folder"></i> ${file.name}</div>
                        ${fileInfo}
                    </div>`;
            } else {
                listItems[1] += `<div class="row">
                        <div class="col-8 file" data-name="${file.name}"><i class="fa fa-file"></i> ${file.name}</div>
                        ${fileInfo}
                    </div>`;
            }
        });
        const dirHTML =  listItems[0];
        const fileHTML = listItems[1];

        filesDiv.innerHTML = dirHTML + fileHTML;

        backButton.classList.remove('d-none');
        const prevPath = dir.split('/').slice(0, -1).join('/');
        backButton.innerText = 'back to ' + (prevPath !== '' ? prevPath : '/');
        if(currentDir === '/') {
            backButton.classList.add('d-none');
        }

        document.querySelectorAll('div.directory').forEach(div => {
            div.addEventListener('click', async (event) => {
                checkSelected(true);
                if(dir !== '/') {
                    currentDir = `${dir}/${event.target.dataset.name}`;
                } else {
                    currentDir = `/${event.target.dataset.name}`;
                }
                await listFiles(currentDir);
            });
        });

        document.querySelectorAll('.file').forEach(div => {
            div.addEventListener('click', (event) => {
                const fileName = event.target.dataset.name;
                if (selectedFiles.includes(fileName)) {
                    selectedFiles = selectedFiles.filter(file => file !== fileName);
                    event.target.classList.remove('file-selected');
                } else {
                    selectedFiles.push(fileName);
                    event.target.classList.add('file-selected');
                }
                checkSelected();
            });
        });
    }

    function FileSize(bytes, si=false, dp=1) {
        const thresh = si ? 1000 : 1024;

        if (Math.abs(bytes) < thresh) {
            return bytes + ' B';
        }

        const units = si
            ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
            : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
        let u = -1;
        const r = 10**dp;

        do {
            bytes /= thresh;
            ++u;
        } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


        return bytes.toFixed(dp) + ' ' + units[u];
    }

    function addZero(string) {
        string = string.toString()
        if(string.length < 2) {
            string = '0' + string;
        }
        return string
    }

    function checkSelected(clear = false) {
        if(clear) {
            selectedFiles = [];
        }
        if(selectedFiles.length > 0) {
            downloadButton.classList.remove('d-none');
        } else {
            downloadButton.classList.add('d-none');
        }
    }

    function checkNavbar() {
        const nHeight = navBar.offsetHeight;
        body.style.paddingTop = (nHeight+20) + 'px';
    }
});