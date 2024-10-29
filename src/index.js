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
    const deleteButton = document.getElementById('deleteButton');
    const uploadButton = document.getElementById('uploadButton');
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
        uploadButton.classList.remove('d-none');
    }

    connectIPButton.addEventListener('click', () => {
        connectIP();
    });

    uploadButton.addEventListener('click', () => {
        upload();
    });

    function connectIP() {
        const modalElement = document.getElementById('promptModal');
        const promptModal = new bootstrap.Modal(document.getElementById('promptModal'), {
            keyboard: false
        });

        const doConnect = async (ip) => {
            try {
                await electronAPI.invoke('connect-ip', ip.value);
                await checkDevices();
                promptModal.remove();
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
        promptModal.show();
    }

    async function upload() {
        const file = await electronAPI.invoke('upload',  currentDeviceId, currentDir);
        if(file && file.length > 0) {
            setTimeout(() => {
                listFiles(currentDir);
            }, 200);
        }
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

            deleteButton.addEventListener('click', async () => {
                if (selectedFiles.length === 0) {
                    alert('No files selected to delete.');
                    return;
                }
                const confirmModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
                confirmModal.show();

                const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
                confirmDeleteBtn.onclick = async () => {
                    const success = await electronAPI.invoke('delete-files', currentDeviceId, currentDir, selectedFiles);
                    if (success) {
                        alert('Files deleted successfully.');
                        const selectedElements = document.querySelectorAll('.file.file-selected');
                        await listFiles(currentDir);
                    } else {
                        alert('Error downloading files.');
                    }
                    confirmModal.hide();
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
                        <div class="col-7 directory" data-name="${file.name}"><i class="fa fa-folder"></i> ${file.name}</div>
                        ${fileInfo}
                    </div>`;
            } else {
                const actions_start = '<div class="col-1 actions">';
                const actions_end = '</div>'
                const remove = `<i class="fa fa-trash delete text-danger" data-file="${file.name}"></i>`;
                let preview = '';
                if(
                    file.name.toLowerCase().indexOf('.jpg') === file.name.length - 4 ||
                    file.name.toLowerCase().indexOf('.png') === file.name.length - 4
                ) {
                    const type = file.name.substring(file.name.length - 3);
                    preview = `<i class="fa fa-search-plus preview" data-image="${file.name}" data-type="${type}"></i>`;
                }
                listItems[1] += `<div class="row">
                        <div class="col-7 file" data-name="${file.name}"><i class="fa fa-file"></i> ${file.name}</div>
                        ${actions_start}
                            ${preview}
                            ${remove}
                        ${actions_end}
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

        document.querySelectorAll('.preview').forEach(div => {
            div.addEventListener('click', async (event) => {
                const fileName = event.target.dataset.image;
                const fileType = event.target.dataset.type;
                const success = await electronAPI.invoke('preview', currentDeviceId, currentDir, fileName);
                if (success) {
                    const modalTitle = document.getElementById('imageModalLabel');
                    modalTitle.innerText = fileName;
                    const modalImage = document.getElementById('modalImage');
                    modalImage.src = `data:image/${fileType};base64,${success}`;

                    const modal = new bootstrap.Modal(document.getElementById('imageModal'));
                    modal.show();
                } else {
                    alert('Something went wrong!');
                }
            });
        });

        document.querySelectorAll('.delete').forEach(div => {
            div.addEventListener('click', async (event) => {
                const fileName = event.target.dataset.file;
                const confirmModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
                confirmModal.show();

                const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
                confirmDeleteBtn.onclick = async () => {
                    const success = await electronAPI.invoke('delete', currentDeviceId, currentDir, fileName);
                    if (success) {
                        setTimeout(() => {
                            listFiles(currentDir);
                        }, 200);
                    } else {
                        alert('Something went wrong!');
                    }
                    confirmModal.hide();
                }
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
            deleteButton.classList.remove('d-none');
        } else {
            downloadButton.classList.add('d-none');
            deleteButton.classList.add('d-none');
        }
    }

    function checkNavbar() {
        const nHeight = navBar.offsetHeight;
        body.style.paddingTop = (nHeight+20) + 'px';
    }
});