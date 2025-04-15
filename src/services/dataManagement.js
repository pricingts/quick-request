import path from 'path';

export function SelectedData(df) {
    return df.map(row => ({
        pol: row['POL'],
        pod: row['POD'],
        cost: row['TOTAL FLETE Y ORIGEN'],
        FDO: row['FDO'],
        FDD: row['FDD'],
        shipping_line: row['Línea'],
        validity: row['FECHA FIN FLETE'],
        type_container: row['TIPO CONT'],
        empty_pickup: row['EMPTY PICKUP']
    }));
}

export function filterData(data, extractedData) {
    const allowedPols = ['baq', 'ctg', 'bun'];
    const today = new Date();

    const userPol = extractedData.pol ? extractedData.pol.toLowerCase() : '';  
    const userPod = extractedData.pod ? extractedData.pod.toLowerCase() : '';
    const userContainer = extractedData.type_container ? extractedData.type_container.toLowerCase() : '';
    const userEmptyPickup = extractedData.empty_pickup ? extractedData.empty_pickup.toLowerCase() : '';

    if (!allowedPols.includes(userPol)) {
        return [];
    }

    function parseDateDDMMYYYY(dateStr) {
        const [day, month, year] = dateStr.split("/");
        return new Date(`${year}-${month}-${day}`);
    }

    return data.filter(row => {
        const polMatch = row.pol && row.pol.toLowerCase().includes(userPol);
        const podMatch = row.pod && row.pod.toLowerCase().includes(userPod);
        const containerMatch = row.type_container && row.type_container.toLowerCase().includes(userContainer);
        const pickupMatch = row.empty_pickup &&
        (row.empty_pickup.toLowerCase().includes(userEmptyPickup) || row.empty_pickup.toLowerCase() === 'todos');

        const rawDate = row["validity"];
        const expiryDate = rawDate ? parseDateDDMMYYYY(rawDate) : null;
        const dateValid = expiryDate && expiryDate >= today;

        const passes = polMatch && podMatch && containerMatch && pickupMatch && dateValid;

        return passes;

    });
}

const portMapping = {
    "BUSAN": ["BUSAN", "BUSAN SERV EC2", "BUSAN SERV JCS"],
};

export function standardizePort(value) {
    if (!value) return "";
    const val = value.toUpperCase().trim();
    for (const [standard, variants] of Object.entries(portMapping)) {
    if (variants.some(variant => val.includes(variant))) {
        return standard;
    }
    }
    return val;
}
