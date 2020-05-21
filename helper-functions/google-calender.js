const {google} = require('googleapis');
require('dotenv').config();

const SCOPES = 'https://www.googleapis.com/auth/calendar';

const CREDENTIALS = JSON.parse(process.env.CREDENTIALS);

const calendarId = process.env.CALENDER_ID;
const calendar = google.calendar({version : "v3"});

const auth = new google.auth.JWT(
    CREDENTIALS.client_email,
    null,
    CREDENTIALS.private_key,
    SCOPES
);

const insertEvent = async (event) => {

    let response = await calendar.events.insert({
        auth: auth,
        calendarId: calendarId,
        resource: event
    });

    if (response['status'] == 200 && response['statusText'] === 'OK') {
        return 1;
    } else {
        return 0;
    }
};

const getEvents = async (dateTimeStart, dateTimeEnd, timeZone) => {

    let response = await calendar.events.list({
        auth: auth,
        calendarId: calendarId,
        timeMin: dateTimeStart,
        timeMax: dateTimeEnd,
        timeZone: timeZone
    });

    let len = response['data']['items'].length;

    return len;
};

module.exports = {
    insertEvent,
    getEvents
}