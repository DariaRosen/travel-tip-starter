import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'

window.onload = onInit

// To make things easier in this project structure 
// functions that are called from DOM are defined on a global app object
window.app = {
    onRemoveLoc,
    onUpdateLoc,
    onSelectLoc,
    onPanToUserPos,
    onSearchAddress,
    onCopyLoc,
    onShareLoc,
    onSetSortBy,
    onSetFilterBy,
    onCancelLoc,
    onSaveLoc,
}

let gUserPos = {
    lat: 0,
    lng: 0
}
let gEditLoc = null // used for edit; null = new loc

function onInit() {
    getFilterByFromQueryParams()

    mapService.initMap()
        .then(() => {
            // onPanToTokyo()
            mapService.addClickListener(onAddLoc)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot init map')
        })

    onPanToUserPos()
    loadAndRenderLocs()
}

function renderLocs(locs) {
    const selectedLocId = getLocIdFromQueryParams()
    console.log('gUserPos renderLocs:', gUserPos)
    console.log('locs renderLocs:', locs)
    
    const isUserPosValid = gUserPos?.lat !== 0 || gUserPos?.lng !== 0
    
    if (isUserPosValid) {
        locs.forEach(loc => {
            if (loc.geo?.lat !== undefined && loc.geo?.lng !== undefined) {
                loc.distance = utilService.getDistance(gUserPos, loc.geo, 'K')
            } else {
                loc.distance = null
            }
        })
    } else {
        // Clear distance values if user position is invalid
        locs.forEach(loc => loc.distance = null)
    }
    locs.forEach((loc, idx) => {
        loc.createdAt = new Date(loc.createdAt)
        loc.updatedAt = new Date(loc.updatedAt)
    })

    var strHTML = locs.map(loc => {
        const className = (loc.id === selectedLocId) ? 'active' : ''
        return `
        <li class="loc ${className}" data-id="${loc.id}">
            <h4>  
                <span>${loc.name}</span>             
                <span class="stars" title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
                <span class="distance">${loc.distance} km</span>
            </h4>
            <span>${loc.geo.address}</span>
            <p class="muted">
                Created: ${utilService.elapsedTime(loc.createdAt)}
                ${(loc.createdAt !== loc.updatedAt) ?
                ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}`
                : ''}
            </p>
            <div class="loc-btns">     
               <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')">🗑️</button>
               <button title="Edit" onclick="app.onUpdateLoc('${loc.id}')">✏️</button>
               <button title="Select" onclick="app.onSelectLoc('${loc.id}')">🗺️</button>
            </div>     
        </li>`}).join('')

    const lastUpdatedGroups = groupByLastUpdated(locs);

    const pieChartData = [
        { label: 'Today', value: lastUpdatedGroups.today },
        { label: 'Past', value: lastUpdatedGroups.past },
        { label: 'Never', value: lastUpdatedGroups.never }
    ]; 

    const elLocList = document.querySelector('.loc-list')
    elLocList.innerHTML = strHTML || 'No locs to show'

    renderLocStats()

    if (selectedLocId) {
        const selectedLoc = locs.find(loc => loc.id === selectedLocId)
        console.log('Selected location:', selectedLoc)
        displayLoc(selectedLoc)
    }
    document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}

function onRemoveLoc(locId) {
    if (!confirm('Are you sure?')) return
    locService.remove(locId)
        .then(() => {
            flashMsg('Location removed')
            unDisplayLoc()
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot remove location')
        })
}

function onSearchAddress(ev) {
    ev.preventDefault()
    const el = document.querySelector('[name=address]')
    mapService.lookupAddressGeo(el.value)
        .then(geo => {
            mapService.panTo(geo)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot lookup address')
        })
}

/*function onAddLoc(geo) {
    console.log('geo:', geo)
    const locName = prompt('Loc name', geo.address || 'Just a place')
    if (!locName) return

    const loc = {
        name: locName,
        rate: +prompt(`Rate (1-5)`, '3'),
        geo
    }
    locService.save(loc)
        .then((savedLoc) => {
            flashMsg(`Added Location (id: ${savedLoc.id})`)
            utilService.updateQueryParams({ locId: savedLoc.id })
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot add location')
        })
}*/

function loadAndRenderLocs() {
    locService.query(gUserPos)
        .then(renderLocs)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot load locations')
        })
}

function onPanToUserPos() {
    mapService.getUserPosition()
        .then(latLng => {
            mapService.panTo({ ...latLng, zoom: 15 })
            unDisplayLoc()
            gUserPos = latLng
            loadAndRenderLocs()
            flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot get your position')
        })
}

/*function onUpdateLoc(locId) {
    locService.getById(locId)
        .then(loc => {
            const rate = prompt('New rate?', loc.rate)
            if (rate && rate !== loc.rate) {
                loc.rate = rate
                locService.save(loc)
                    .then(savedLoc => {
                        flashMsg(`Rate was set to: ${savedLoc.rate}`)
                        loadAndRenderLocs()
                    })
                    .catch(err => {
                        console.error('OOPs:', err)
                        flashMsg('Cannot update location')
                    })

            }
        })
}*/

function onSelectLoc(locId) {
    return locService.getById(locId)
        .then(displayLoc)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot display this location')
        })
}

function displayLoc(loc) {
    if (!loc || !loc.geo || typeof loc.geo.lat !== 'number' || typeof loc.geo.lng !== 'number') {
        console.warn('Invalid location data:', loc)
        flashMsg('Cannot display location – invalid coordinates')
        return
    }
    document.querySelector('.loc.active')?.classList?.remove('active')
    document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

    mapService.panTo(loc.geo)
    mapService.setMarker(loc)

    const el = document.querySelector('.selected-loc')
    el.querySelector('.loc-name').innerText = loc.name
    el.querySelector('.loc-address').innerText = loc.geo.address
    el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
    el.querySelector('[name=loc-copier]').value = window.location
    el.classList.add('show')

    utilService.updateQueryParams({ locId: loc.id })
}

function unDisplayLoc() {
    utilService.updateQueryParams({ locId: '' })
    document.querySelector('.selected-loc').classList.remove('show')
    mapService.setMarker(null)
}

function onCopyLoc() {
    const elCopy = document.querySelector('[name=loc-copier]')
    elCopy.select()
    elCopy.setSelectionRange(0, 99999) // For mobile devices
    navigator.clipboard.writeText(elCopy.value)
    flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
    const url = document.querySelector('[name=loc-copier]').value

    // title and text not respected by any app (e.g. whatsapp)
    const data = {
        title: 'Cool location',
        text: 'Check out this location',
        url
    }
    navigator.share(data)
}

function flashMsg(msg) {
    const el = document.querySelector('.user-msg')
    el.innerText = msg
    el.classList.add('open')
    setTimeout(() => {
        el.classList.remove('open')
    }, 3000)
}

function getFilterByFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const txt = queryParams.get('txt') || ''
    const minRate = queryParams.get('minRate') || 0
    locService.setFilterBy({txt, minRate})

    document.querySelector('input[name="filter-by-txt"]').value = txt
    document.querySelector('input[name="filter-by-rate"]').value = minRate
}

function getLocIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const locId = queryParams.get('locId')
    return locId
}

function onSetSortBy() {
    const prop = document.querySelector('.sort-by').value
    const isDesc = document.querySelector('.sort-desc').checked

    if (!prop) return

    const sortBy = {}
    sortBy[prop] = (isDesc) ? -1 : 1

    // Shorter Syntax:
    // const sortBy = {
    //     [prop] : (isDesc)? -1 : 1
    // }

    locService.setSortBy(sortBy)
    loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
    const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
    utilService.updateQueryParams(filterBy)
    loadAndRenderLocs()
}

function renderLocStats() {
    locService.getLocCountByRateMap().then(stats => {
        handleStats(stats, 'loc-stats-rate')
    })
    locService.getLocCountByUpdatedMap().then(stats => {
        handleStats(stats, 'loc-stats-update')
    })
}

function handleStats(stats, selector) {
    // stats = { low: 37, medium: 11, high: 100, total: 148 }
    // stats = { low: 5, medium: 5, high: 5, baba: 55, mama: 30, total: 100 }
    const labels = cleanStats(stats)
    const colors = utilService.getColors()
    var sumPercent = 0
    var colorsStr = `${colors[0]} ${0}%, `
    labels.forEach((label, idx) => {
        if (idx === labels.length - 1) return
        const count = stats[label]
        const percent = Math.round((count / stats.total) * 100, 2)
        sumPercent += percent
        colorsStr += `${colors[idx]} ${sumPercent}%, `
        if (idx < labels.length - 1) {
            colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
        }
    })

    colorsStr += `${colors[labels.length - 1]} ${100}%`
    // Example:
    // colorsStr = `purple 0%, purple 33%, blue 33%, blue 67%, red 67%, red 100%`74\245]89|+
    const elPie = document.querySelector(`.${selector} .pie`)
    const style = `background-image: conic-gradient(${colorsStr})`
    elPie.style = style

    const ledendHTML = labels.map((label, idx) => {
        return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
    }).join('')

    const elLegend = document.querySelector(`.${selector} .legend`)
    elLegend.innerHTML = ledendHTML
}

function cleanStats(stats) {
    const cleanedStats = Object.keys(stats).reduce((acc, label) => {
        if (label !== 'total' && stats[label]) {
            acc.push(label)
        }
        return acc
    }, [])
    return cleanedStats
}

function groupByLastUpdated(locs) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // zero out time for comparison

    const groups = {
        today: 0,
        past: 0,
        never: 0
    };

    locs.forEach(loc => {
        if (!loc.updatedAt) {
            groups.never++;
        } else {
            const lastDate = new Date(loc.updatedAt);
            lastDate.setHours(0, 0, 0, 0);

            if (lastDate.getTime() === today.getTime()) {
                groups.today++;
            } else if (lastDate.getTime() < today.getTime()) {
                groups.past++;
            } else {
                // If updatedAt is in the future (unlikely), you can handle or ignore
                groups.past++; // or groups.future = 1;
            }
        }
    });

    return groups;
}

/*function onAddLoc(geo) {
    const dialog = document.getElementById('loc-modal')
    dialog.querySelector('.modal-title').innerText = 'Add Location'

    // Translate coordinates into a readable address
    mapService.lookupAddressGeo(geo).then(address => {
        const nameInput = dialog.querySelector('[name="name"]')
        nameInput.value = address || `Lat: ${geo.lat.toFixed(3)}, Lng: ${geo.lng.toFixed(3)}`
    })

    dialog.querySelector('[name="rate"]').value = ''
    dialog.setAttribute('data-geo', JSON.stringify(geo))
    dialog.showModal()
}*/
function onAddLoc(geo) {
    mapService.lookupAddressGeo(geo).then((resolvedGeo) => {
        const loc = {
            name: resolvedGeo.address || 'Just a place',
            rate: 3,
            geo: resolvedGeo
        }

        // Pre-fill the form and open the modal
        const dialog = document.getElementById('loc-modal')
        dialog.querySelector('.modal-title').innerText = 'Add Location'
        dialog.querySelector('[name="name"]').value = loc.name
        dialog.querySelector('[name="rate"]').value = loc.rate
        dialog.dataset.geo = JSON.stringify(loc.geo)
        dialog.showModal()
    }).catch(err => {
        console.error('Failed to lookup address', err)
    })
}




function onUpdateLoc(locId) {
    locService.getById(locId).then(loc => {
        gEditLoc = loc
        const dialog = document.getElementById('loc-modal')
        dialog.querySelector('.modal-title').innerText = 'Update Location'
        dialog.querySelector('[name="name"]').value = loc.name
        dialog.querySelector('[name="rate"]').value = loc.rate
        dialog.removeAttribute('data-geo') // not used for update
        dialog.showModal()
    })
}

function onCancelLoc() {
    const dialog = document.getElementById('loc-modal')
    dialog.close()
}

function onSaveLoc(ev) {
    ev.preventDefault()

    const dialog = document.getElementById('loc-modal')
    const name = dialog.querySelector('[name="name"]').value
    const rate = +dialog.querySelector('[name="rate"]').value

    const locToSave = gEditLoc ? { ...gEditLoc, name, rate } : {
        name,
        rate,
        createdAt: Date.now(),
        geo: JSON.parse(dialog.dataset.geo),
        lastUpdated: Date.now(),
    }

    locService.save(locToSave)
        .then(savedLoc => {
            flashMsg(`Location ${gEditLoc ? 'updated' : 'added'}: ${savedLoc.name}`)
            gEditLoc = null
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot save location')
        })

    dialog.close()
}


