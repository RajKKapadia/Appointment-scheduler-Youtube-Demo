const axios = require('axios');
require('dotenv').config();

const APP_ID = process.env.APP_ID;
const API_KEY = process.env.API_KEY;

// Get the Last Question Asked and the Level
const checkAppointmentExist = async (date, time) => {

    url = `https://api.airtable.com/v0/${APP_ID}/Appointments?view=Grid%20view&filterByFormula=(AND({Appointment Date}="${date}", {Appointment Time}="${time}"))&maxRecords=5`;
    headers = {
        Authorization: `Bearer ${API_KEY}`
    }
    
    let response = await axios.get(url, {headers});
    let records = response['data']['records'];

    let len = records.length;

    return len;
};

const insertAppointment = async (fields) => {

    url = `https://api.airtable.com/v0/${APP_ID}/Appointments`;
    headers = {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
    }

    let response = await axios.post(url, {fields}, {headers});

    if (response.status == 200) {
        return 1;
    } else {
        return 0;
    }
};

const getTimeslots = async (date) => {

    url = `https://api.airtable.com/v0/${APP_ID}/Appointments?view=Grid%20view&filterByFormula=(AND({Appointment Date}="${date}"))`;
    headers = {
        Authorization: `Bearer ${API_KEY}`
    }
    
    let response = await axios.get(url, {headers});
    let records = response['data']['records'];

    let totalTimeSlots = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
    let filledTimeSlots = []

    records.forEach(record => {
        filledTimeSlots.push(record['fields']['Appointment Time']);
    });

    let availableTimeSlots = totalTimeSlots.filter(x => !filledTimeSlots.includes(x));

    return availableTimeSlots;
};

module.exports = {
    checkAppointmentExist,
    insertAppointment,
    getTimeslots
}