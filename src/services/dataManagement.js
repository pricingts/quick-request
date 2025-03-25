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

    const userPol = extractedData.pol ? extractedData.pol.toLowerCase() : '';  
    const userPod = extractedData.pod ? extractedData.pod.toLowerCase() : '';
    const userContainer = extractedData.type_container ? extractedData.type_container.toLowerCase() : '';
    const userEmptyPickup = extractedData.empty_pickup ? extractedData.empty_pickup.toLowerCase() : '';

    if (allowedPols.includes(userPol)) {
        return data.filter(row => {
            return row.pol &&
            row.pol.toLowerCase().includes(userPol) &&
            row.pod &&
            row.pod.toLowerCase().includes(userPod) &&
            row.type_container &&
            row.type_container.toLowerCase().includes(userContainer) &&
            (row.empty_pickup &&
                (row.empty_pickup.toLowerCase().includes(userEmptyPickup) || row.empty_pickup.toLowerCase() === 'todos'));
        });
    } else {
    return [];
    }
}
