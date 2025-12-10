/*
 * Script Name: Clear Barbarian Relics
 * Version: v1.7.0
 * Last Updated: 2025-12-10
 * Modified by: Claude (based on RedAlert's Clear Barbarian Walls)
 * Original Author: RedAlert
 */

var scriptData = {
    name: 'Clear Barbarian Relics',
    version: 'v1.7.0',
};

// User Input
//if (typeof DEBUG !== 'boolean') DEBUG = false;

// Globals
var ALLOWED_GAME_SCREENS = ['map'];
var COORDS_REGEX = /[0-9]{1,3}\|[0-9]{1,3}/g;

if (typeof TWMap === 'undefined') TWMap = {};
if ('TWMap' in window) mapOverlay = TWMap;

// Data Store Config
var STORAGE_KEY = 'RA_CBR_STORE';
var DEFAULT_STATE = {
    MAX_BARBARIANS: 100,
    MAX_FA_PAGES_TO_FETCH: 20,
};

// Relic quality colors (from game CSS)
var RELIC_COLORS = {
    'shoddy': '#5f5f5f',      // Gris
    'polished': '#339a3f',    // Verde
    'refined': '#3b4cb4',     // Azul
    'superior': '#6a3bb4',    // Púrpura
    'renowned': '#b4573b',    // Marrón/Naranja
    'unknown': '#dc3545'      // Rojo para desconocido
};

// Translations
var translations = {
    en_DK: {
        'Clear Barbarian Relics': 'Clear Barbarian Relics',
        Help: 'Help',
        'This script requires PA and FA to be active!': 'This script requires PA and FA to be active!',
        'Redirecting...': 'Redirecting...',
        'Fetching FA pages...': 'Fetching FA pages...',
        'Finished fetching FA pages!': 'Finished fetching FA pages!',
        Fetching: 'Fetching',
        'No barbarian villages found fitting the criteria!': 'No barbarian villages found fitting the criteria!',
        Type: 'Type',
        Barbarian: 'Barbarian',
        Report: 'Report',
        Distance: 'Distance',
        'Relic Quality': 'Relic Quality',
        'Relic Name': 'Relic Name',
        'Last Attack Time': 'Last Attack Time',
        Actions: 'Actions',
        Attack: 'Attack',
        'barbarian villages where found': 'barbarian villages where found',
        'Showing the first': 'Showing the first',
        'barbarian villages.': 'barbarian villages.',
        Settings: 'Settings',
        'Save Settings': 'Save Settings',
        'Maximum villages to show on the table': 'Maximum villages to show on the table',
        'Maximum FA Pages to fetch': 'Maximum FA Pages to fetch',
        'Settings saved!': 'Settings saved!',
        'Unknown': 'Unknown',
        'Shoddy': 'Shoddy',
        'Polished': 'Polished',
        'Refined': 'Refined',
        'Superior': 'Superior',
        'Renowned': 'Renowned',
    },
};

initDebug();

async function initClearBarbarianRelics(store) {
    const { MAX_BARBARIANS, MAX_FA_PAGES_TO_FETCH } = store;
    const faURLs = await fetchFAPages(MAX_FA_PAGES_TO_FETCH);

    startProgressBar(faURLs.length);
    UI.SuccessMessage(tt('Fetching FA pages...'));

    const faPages = [];
    jQuery.fetchAll(
        faURLs,
        function (index, data) {
            updateProgressBar(index, faURLs.length);
            const { plunder_list } = data;
            faPages.push(...plunder_list);
        },
        function () {
            const faTableRows = getFATableRows(faPages);
            const barbarians = getFABarbarians(faTableRows);

            const content = prepareContent(barbarians, MAX_BARBARIANS);
            renderUI(content);
            jQuery('#barbVillagesCount').text(barbarians.length);

            updateMap(barbarians);
            showSettingsPanel(store);
        },
        function (error) {
            UI.ErrorMessage('Error fetching FA pages!');
            console.error(`${scriptInfo()} Error:`, error);
        }
    );
}

function updateMap(barbarians) {
    const barbCoords = barbarians.map((barbarian) => barbarian.coord);
    
    if (mapOverlay.mapHandler._spawnSector) {
    } else {
        mapOverlay.mapHandler._spawnSector = mapOverlay.mapHandler.spawnSector;
    }

    TWMap.mapHandler.spawnSector = function (data, sector) {
        mapOverlay.mapHandler._spawnSector(data, sector);
        var beginX = sector.x - data.x;
        var endX = beginX + mapOverlay.mapSubSectorSize;
        var beginY = sector.y - data.y;
        var endY = beginY + mapOverlay.mapSubSectorSize;
        
        for (var x in data.tiles) {
            var x = parseInt(x, 10);
            if (x < beginX || x >= endX) continue;
            
            for (var y in data.tiles[x]) {
                var y = parseInt(y, 10);
                if (y < beginY || y >= endY) continue;
                
                var xCoord = data.x + x;
                var yCoord = data.y + y;
                var v = mapOverlay.villages[xCoord * 1000 + yCoord];
                
                if (v) {
                    var vXY = '' + v.xy;
                    var vCoords = vXY.slice(0, 3) + '|' + vXY.slice(3, 6);
                    
                    if (barbCoords.includes(vCoords)) {
                        const currentBarbarian = barbarians.find(
                            (obj) => obj.villageId == v.id
                        );

                        const relicQuality = currentBarbarian.relicQuality || 'unknown';
                        const relicColor = RELIC_COLORS[relicQuality] || RELIC_COLORS['unknown'];
                        const displayText = currentBarbarian.relicQualityShort || '?';

                        const eleDIV = $('<div></div>')
                            .css({
                                border: '2px solid ' + relicColor,
                                position: 'absolute',
                                backgroundColor: relicColor,
                                color: '#fff',
                                width: '32px',
                                height: '16px',
                                marginTop: '20px',
                                marginLeft: '9px',
                                display: 'block',
                                zIndex: '10',
                                fontWeight: 'bold',
                                textAlign: 'center',
                                fontSize: '11px',
                                lineHeight: '16px',
                                textShadow: '1px 1px 2px #000',
                            })
                            .attr('id', 'relic' + v.id)
                            .html(displayText);

                        sector.appendElement(
                            eleDIV[0],
                            data.x + x - sector.x,
                            data.y + y - sector.y
                        );
                    }
                }
            }
        }
    };

    mapOverlay.reload();
}

function prepareContent(villages, maxBarbsToShow) {
    if (villages.length) {
        const barbsTable = buildBarbsTable(villages, maxBarbsToShow);
        var content = `
            <div>
                <p>
                    <b><span id="barbVillagesCount"></span> ${tt('barbarian villages where found')}</b><br>
                    <em>${tt('Showing the first')} ${maxBarbsToShow} ${tt('barbarian villages.')}</em>
                </p>
            </div>
            <div class="ra-table-container">
                ${barbsTable}
            </div>
        `;
        return content;
    } else {
        return `<b>${tt('No barbarian villages found fitting the criteria!')}</b>`;
    }
}

function renderUI(body) {
    const content = `
        <div class="ra-clear-barbs-walls" id="raClearBarbWalls">
            <div class="ra-clear-barbs-walls-header">
                <h3>${tt(scriptData.name)}</h3>
                <a href="javascript:void(0);" id="showSettingsPanel" class="btn-show-settings">
                    <span class="icon header settings"></span>
                </a>
            </div>
            <div class="ra-clear-barbs-walls-body">
                ${body}
            </div>
            <div class="ra-clear-barbs-walls-footer">
              
            </div>
        </div>
        <style>
            .ra-clear-barbs-walls { position: relative; display: block; width: 100%; height: auto; clear: both; margin: 10px 0 15px; border: 1px solid #603000; box-sizing: border-box; background: #f4e4bc; }
            .ra-clear-barbs-walls * { box-sizing: border-box; }
            .ra-clear-barbs-walls > div { padding: 10px; }
            .ra-clear-barbs-walls .btn-confirm-yes { padding: 3px; }
            .ra-clear-barbs-walls-header { display: flex; align-items: center; justify-content: space-between; background-color: #c1a264 !important; background-image: url(/graphic/screen/tableheader_bg3.png); background-repeat: repeat-x; }
            .ra-clear-barbs-walls-header h3 { margin: 0; padding: 0; line-height: 1; }
            .ra-clear-barbs-walls-body p { font-size: 14px; }
            .ra-clear-barbs-walls-body label { display: block; font-weight: 600; margin-bottom: 6px; }
            
            .ra-table-container { overflow-y: auto; overflow-x: hidden; height: auto; max-height: 312px; border: 1px solid #bc6e1f; }
            .ra-table th { font-size: 14px; }
            .ra-table th, .ra-table td { padding: 3px; text-align: center; }
            .ra-table td a { word-break: break-all; }
            .ra-table a:focus { color: blue; }
            .ra-table a.btn:focus { color: #fff; }
            .ra-table tr:nth-of-type(2n) td { background-color: #f0e2be }
            .ra-table tr:nth-of-type(2n+1) td { background-color: #fff5da; }
            
            .relic-badge { 
                display: inline-block; 
                padding: 2px 8px; 
                border-radius: 3px; 
                color: #fff; 
                font-weight: bold; 
                font-size: 11px;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            }
            
            .ra-popup-content { width: 360px; }
            .ra-popup-content * { box-sizing: border-box; }
            .ra-popup-content input[type="text"] { padding: 3px; width: 100%; }
            
            .ra-mb15 { margin-bottom: 15px; }
            .already-sent-command { opacity: 0.6; }
        </style>
    `;

    if (jQuery('#raClearBarbWalls').length < 1) {
        jQuery('#contentContainer').prepend(content);
    } else {
        jQuery('.ra-clear-barbs-walls-body').html(body);
    }
}

function showSettingsPanel(store) {
    jQuery('#showSettingsPanel').on('click', function (e) {
        e.preventDefault();
        const { MAX_BARBARIANS, MAX_FA_PAGES_TO_FETCH } = store;

        const content = `
            <div class="ra-popup-content">
                <div class="ra-popup-header">
                    <h3>${tt('Settings')}</h3>
                </div>
                <div class="ra-popup-body ra-mb15">
                    <table class="ra-settings-table" width="100%">
                        <tbody>
                            <tr>
                                <td width="80%">
                                    <label for="maxBarbVillages">${tt('Maximum villages to show on the table')}</label>
                                </td>
                                <td width="30%">
                                    <input type="text" name="max_barb_villages" id="maxBarbVillages" value="${MAX_BARBARIANS}" />
                                </td>
                            </tr>
                            <tr>
                                <td width="80%">
                                    <label for="maxFApages">${tt('Maximum FA Pages to fetch')}</label>
                                </td>
                                <td width="30%">
                                    <input type="text" name="max_fa_pages" id="maxFApages" value="${MAX_FA_PAGES_TO_FETCH}" />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="ra-popup-footer">
                    <a href="javascript:void(0);" id="saveSettingsBtn" class="btn btn-confirm-yes">
                        ${tt('Save Settings')}
                    </a>
                </div>
            </div>
        `;

        Dialog.show('SettingsPanel', content);
        saveSettings();
    });
}

function saveSettings() {
    jQuery('#saveSettingsBtn').on('click', function (e) {
        e.preventDefault();
        const maxBarbVillages = jQuery('#maxBarbVillages').val();
        const maxFApages = jQuery('#maxFApages').val();

        const data = {
            MAX_BARBARIANS: maxBarbVillages,
            MAX_FA_PAGES_TO_FETCH: maxFApages,
        };

        writeStorage(data, readStorage(DEFAULT_STATE));
        UI.SuccessMessage(tt('Settings saved!'), 1000);
        initClearBarbarianRelics(data);
    });
}

function buildBarbsTable(villages, maxBarbsToShow) {
    villages = villages.slice(0, maxBarbsToShow);

    let barbsTable = `
        <table class="ra-table" width="100%">
            <thead>
                <tr>
                    <th>#</th>
                    <th>${tt('Type')}</th>
                    <th>${tt('Barbarian')}</th>
                    <th>${tt('Report')}</th>
                    <th>${tt('Distance')}</th>
                    <th>${tt('Relic Quality')}</th>
                    <th>${tt('Relic Name')}</th>
                    <th>${tt('Last Attack Time')}</th>
                    <th>${tt('Actions')}</th>
                </tr>
            </thead>
            <tbody>
    `;

    villages.forEach((village, index) => {
        index++;
        const { villageId, coord, relicQuality, relicName, reportId, reportTime, type, distance } = village;

        const villageUrl = `${game_data.link_base_pure}info_village&id=${villageId}`;
        const reportUrl = `${game_data.link_base_pure}report&mode=all&view=${reportId}`;
        const commandUrl = `${game_data.link_base_pure}place&target=${villageId}`;

        const relicColor = RELIC_COLORS[relicQuality] || RELIC_COLORS['unknown'];
        const relicQualityText = tt(relicQuality.charAt(0).toUpperCase() + relicQuality.slice(1)) || tt('Unknown');

        barbsTable += `
            <tr>
                <td>${index}</td>
                <td><img src="${type}"></td>
                <td>
                    <a href="${villageUrl}" target="_blank" rel="noopener noreferrer">${coord}</a>
                </td>
                <td>
                    <a href="${reportUrl}" target="_blank" rel="noopener noreferrer">
                        <span class="icon header new_report"></span>
                    </a>
                </td>
                <td>${distance}</td>
                <td>
                    <span class="relic-badge" style="background-color: ${relicColor};">
                        ${relicQualityText}
                    </span>
                </td>
                <td>${relicName || '-'}</td>
                <td>${reportTime}</td>
                <td>
                    <a href="${commandUrl}" onClick="highlightOpenedCommands(this);" class="ra-clear-barb-wall-btn btn" target="_blank" rel="noopener noreferrer">
                        ${tt('Attack')}
                    </a>
                </td>
            </tr>
        `;
    });

    barbsTable += `</tbody></table>`;
    return barbsTable;
}

function highlightOpenedCommands(element) {
    element.classList.add('btn-confirm-yes');
    element.classList.add('btn-already-sent');
    element.parentElement.parentElement.classList.add('already-sent-command');
}

async function fetchFAPages(maxFAPagesToFetch) {
    const faPageURLs = await jQuery
        .get(game_data.link_base_pure + 'am_farm')
        .then((response) => {
            const htmlDoc = jQuery.parseHTML(response);
            const plunderListNav = jQuery(htmlDoc).find('#plunder_list_nav:eq(0) a');
            const firstFApage = game_data.link_base_pure + `am_farm&ajax=page_entries&Farm_page=0&class=&extended=1`;

            const faPageURLs = [firstFApage];
            jQuery(plunderListNav).each(function (index) {
                index++;
                if (index <= maxFAPagesToFetch - 1) {
                    const currentPageNumber = parseInt(
                        getParameterByName('Farm_page', window.location.origin + jQuery(this).attr('href'))
                    );
                    faPageURLs.push(
                        game_data.link_base_pure +
                            `am_farm&ajax=page_entries&Farm_page=${currentPageNumber}&class=&extended=1&order=distance&dir=asc`
                    );
                }
            });

            return faPageURLs;
        })
        .catch((error) => {
            UI.ErrorMessage('Error fetching FA page!');
            console.error(`${scriptInfo()} Error:`, error);
        });

    return faPageURLs;
}

function getFATableRows(pages) {
    let barbariansText = '';
    pages.forEach((page) => {
        barbariansText += page;
    });
    return jQuery.parseHTML(barbariansText);
}

function getFABarbarians(rows) {
    let barbarians = [];

    rows.forEach((row) => {
        let shouldAdd = false;

        let villageId = parseInt(
            getParameterByName(
                'target',
                window.location.origin + jQuery(row).find('td').last().find('a').attr('href')
            )
        );
        let coord = jQuery(row).find('td:eq(3) a').text().match(COORDS_REGEX)[0];
        let distance = jQuery(row).find('td:eq(7)').text().trim();
        let reportId = parseInt(
            getParameterByName('view', window.location.origin + jQuery(row).find('td:eq(3) a').attr('href'))
        );
        let reportTime = jQuery(row).find('td:eq(4)').text().trim();
        let type = jQuery(row).find('td:eq(1) img').attr('src');

        // Extract relic information from report link
        let relicQuality = 'unknown';
        let relicQualityShort = '?';
        let relicName = '';

        // Check if row contains relic information
        const relicElement = jQuery(row).find('.relic-quality-shoddy, .relic-quality-polished, .relic-quality-refined, .relic-quality-superior, .relic-quality-renowned');
        
        if (relicElement.length > 0) {
            shouldAdd = true;
            const relicClass = relicElement.attr('class');
            
            if (relicClass.includes('shoddy')) {
                relicQuality = 'shoddy';
                relicQualityShort = 'S';
            } else if (relicClass.includes('polished')) {
                relicQuality = 'polished';
                relicQualityShort = 'P';
            } else if (relicClass.includes('refined')) {
                relicQuality = 'refined';
                relicQualityShort = 'Rf';
            } else if (relicClass.includes('superior')) {
                relicQuality = 'superior';
                relicQualityShort = 'Sp';
            } else if (relicClass.includes('renowned')) {
                relicQuality = 'renowned';
                relicQualityShort = 'Rn';
            }
            
            relicName = relicElement.text().trim();
        }

        if (shouldAdd) {
            barbarians.push({
                villageId: villageId,
                coord: coord,
                distance: distance,
                relicQuality: relicQuality,
                relicQualityShort: relicQualityShort,
                relicName: relicName,
                reportId: reportId,
                reportTime: reportTime,
                type: type,
            });
        }
    });

    return barbarians;
}

$.fetchAll = function (urls, onLoad, onDone, onError) {
    var numDone = 0;
    var lastRequestTime = 0;
    var minWaitTime = 250;
    loadNext();
    
    function loadNext() {
        if (numDone == urls.length) {
            onDone();
            return;
        }

        let now = Date.now();
        let timeElapsed = now - lastRequestTime;
        if (timeElapsed < minWaitTime) {
            let timeRemaining = minWaitTime - timeElapsed;
            setTimeout(loadNext, timeRemaining);
            return;
        }
        lastRequestTime = now;
        $.get(urls[numDone])
            .done((data) => {
                try {
                    onLoad(numDone, data);
                    ++numDone;
                    loadNext();
                } catch (e) {
                    onError(e);
                }
            })
            .fail((xhr) => {
                onError(xhr);
            });
    }
};

function startProgressBar(total) {
    const width = jQuery('#contentContainer')[0].clientWidth;
    const preloaderContent = `
        <div id="progressbar" class="progress-bar" style="margin-bottom:12px;">
            <span class="count label">0/${total}</span>
            <div id="progress">
                <span class="count label" style="width: ${width}px;">0/${total}</span>
            </div>
        </div>
    `;
    $('#contentContainer').eq(0).prepend(preloaderContent);
}

function updateProgressBar(index, total) {
    jQuery('#progress').css('width', `${((index + 1) / total) * 100}%`);
    jQuery('.count').text(`${tt('Fetching')} ${index + 1}/${total}`);
    if (index + 1 == total) {
        UI.SuccessMessage(tt('Finished fetching FA pages!'));
        jQuery('#progressbar').fadeOut(1000);
    }
}

function readStorage(defaultState) {
    let storedState = sessionStorage.getItem(STORAGE_KEY);
    if (!storedState) return defaultState;
    if (typeof storedState === 'object') return defaultState;
    storedState = JSON.parse(storedState);
    return storedState;
}

function writeStorage(data, initialState) {
    const dataToBeSaved = { ...initialState, ...data };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dataToBeSaved));
}

function getParameterByName(name, url = window.location.href) {
    return new URL(url).searchParams.get(name);
}

function scriptInfo() {
    return `[${scriptData.name} ${scriptData.version}]`;
}

function initDebug() {
    console.debug(`${scriptInfo()} It works 🚀!`);
   
        console.debug(`${scriptInfo()} Market:`, game_data.market);
        console.debug(`${scriptInfo()} World:`, game_data.world);
        console.debug(`${scriptInfo()} Screen:`, game_data.screen);
        console.debug(`${scriptInfo()} Game Version:`, game_data.majorVersion);
        console.debug(`${scriptInfo()} Game Build:`, game_data.version);
        console.debug(`${scriptInfo()} Locale:`, game_data.locale);
        console.debug(`${scriptInfo()} Premium:`, game_data.features.Premium.active);
  
}

function tt(string) {
    var gameLocale = game_data.locale;
    if (translations[gameLocale] !== undefined) {
        return translations[gameLocale][string];
    } else {
        return translations['en_DK'][string];
    }
}

(function () {
    if (game_data.features.FarmAssistent.active && game_data.features.Premium.active) {
        const gameScreen = getParameterByName('screen');
        if (ALLOWED_GAME_SCREENS.includes(gameScreen)) {
            const state = readStorage(DEFAULT_STATE);
            initClearBarbarianRelics(state);
        } else {
            UI.InfoMessage(tt('Redirecting...'));
            window.location.assign(game_data.link_base_pure + 'map');
        }
    } else {
        UI.ErrorMessage(tt('This script requires PA and FA to be active!'));
    }
})();