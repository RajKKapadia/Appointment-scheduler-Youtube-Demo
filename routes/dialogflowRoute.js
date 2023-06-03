const express = require('express');
const router = express.Router();

const ad = require('../helper-functions/airtable-database');
const gc = require('../helper-functions/google-calender');

// Converts the date and time from Dialogflow into
// date --> year-month-day
// time --> hour:minute
// hour --> (Integer) hour
const getDateTimeHour = (date, time) => {

    let year = date.split('T')[0].split('-')[0];
    let month = date.split('T')[0].split('-')[1];
    let day = date.split('T')[0].split('-')[2];

    let hour = time.split('T')[1].split(':')[0];
    let minute = time.split('T')[1].split(':')[1];

    return {
        'date': `${year}-${month}-${day}`,
        'time': `${hour}:${minute}`,
        'hour': parseInt(hour)
    };
};

// Converts the date and time from Dialogflow into
// January 18, 9:30 AM
const dateTimeToString = (date, time) => {

    let year = date.split('T')[0].split('-')[0];
    let month = date.split('T')[0].split('-')[1];
    let day = date.split('T')[0].split('-')[2];

    let hour = time.split('T')[1].split(':')[0];
    let minute = time.split('T')[1].split(':')[1];

    let newDateTime = `${year}-${month}-${day}T${hour}:${minute}`;

    let event = new Date(Date.parse(newDateTime));

    let options = { month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };

    return event.toLocaleDateString('en-US', options);
};

const TIMEOFFSET = '+05:30';

// Get date-time string for calender
const dateTimeForCalander = (date, time) => {

    let year = date.split('T')[0].split('-')[0];
    let month = date.split('T')[0].split('-')[1];
    let day = date.split('T')[0].split('-')[2];

    let hour = time.split('T')[1].split(':')[0];
    let minute = time.split('T')[1].split(':')[1];

    let newDateTime = `${year}-${month}-${day}T${hour}:${minute}:00.000${TIMEOFFSET}`;

    let event = new Date(Date.parse(newDateTime));

    let startDate = event;
    let endDate = new Date(new Date(startDate).setHours(startDate.getHours()+1));

    return {
        'start': startDate,
        'end': endDate
    }
};

// Converts 24 hrs time into 12 hrs time
const convertTime24to12 = (time24) => {

    let tmpArr = time24.split(':'), time12;
    
    if (+tmpArr[0] == 12) {
        time12 = tmpArr[0] + ':' + tmpArr[1] + ' PM';
    } else {
        if (+tmpArr[0] == 00) {
            time12 = '12:' + tmpArr[1] + ' AM';
        } else {
            if (+tmpArr[0] > 12) {
                time12 = (+tmpArr[0] - 12) + ':' + tmpArr[1] + ' PM';
            } else {
                time12 = (+tmpArr[0]) + ':' + tmpArr[1] + ' AM';
            }
        }
    }
    return time12;
};

const OPENTIME = 10;
const CLOSETIME = 20;

const TIMEZONE = 'Asia/Kolkata';

// Schedule Appointment Action
const scheduleAppointment = async (req) => {

    let timeString = req['body']['queryResult']['parameters']['time'];
    let dateString = req['body']['queryResult']['parameters']['date'];

    let dateTimeHour = getDateTimeHour(dateString, timeString);
    let appointmentTimeString = dateTimeToString(dateString, timeString);
    let dateTimeCalander = dateTimeForCalander(dateString, timeString);

    let outString;
    let responseText = {};

    // If time is out of range for opening and closing hours
    if (dateTimeHour['hour'] < OPENTIME || dateTimeHour['hour'] > CLOSETIME) {
        outString = 'We are open from 10 AM to 8 PM, please choose a time in between.';
        responseText = {'fulfillmentText': outString};
    // If time is exactly same as opening and closing hours
    } else if (dateTimeHour['hour'] == OPENTIME || dateTimeHour['hour'] == CLOSETIME) {
        outString = 'Please choose a time after 10 AM and before 8 PM.';
        responseText = {'fulfillmentText': outString};
    // If time is good then check for the existing appointments
    } else {
        // Check here with the airtable data
        // let len = await ad.checkAppointmentExist(dateTimeHour['date'], dateTimeHour['time']);

        //

        //    your code should be here and it should return the numbers of appointment at the
        //    perticular time  

        //

        let len = await gc.getEvents(dateTimeCalander['start'], dateTimeCalander['end'], TIMEZONE);

        if (len != 3 || len < 3) {
            outString = `We are available on ${appointmentTimeString}. Do you want to confirm it?`;
            let session = req['body']['session'];
            let context = `${session}/contexts/await-confirmation`;
            let sessionVars = `${session}/contexts/sessionvars`;
            responseText = {
                'fulfillmentText': outString,
                'outputContexts': [{
                    'name': context,
                    'lifespanCount': 1
                }, {
                    'name': sessionVars,
                    'lifespanCount': 50,
                    'parameters': {
                        'time': timeString,
                        'date': dateString
                    }
                }]
            };
        } else {

            // If we are full at the give time and date
            // Show some options to the user

            let availableTimeSlots = await ad.getTimeslots(dateTimeHour['date']);

            let ATS12Hr = [];

            availableTimeSlots.forEach(slot => {
                ATS12Hr.push(convertTime24to12(slot));
            });
            // If by chance we don't have any free slot
            if (availableTimeSlots.length == 0) {
                outString = `Sorry, we are not available on ${appointmentTimeString}`;
                responseText = {
                    'fulfillmentText': outString
                }
            } else {
                // Show the free time slots
                outString = `Sorry, we are not available on ${appointmentTimeString}. However, we are free on ${appointmentTimeString.split(',')[0]} at ${ATS12Hr[0]}, ${ATS12Hr[1]}, and ${ATS12Hr[2]}`;
                let session = req['body']['session'];
                let rescheduleAppointment = `${session}/contexts/await-reschedule`;
                let sessionVars = `${session}/contexts/sessionvars`;
                responseText = {
                    'fulfillmentText': outString,
                    'outputContexts': [{
                        'name': rescheduleAppointment,
                        'lifespanCount': 1
                    }, {
                        'name': sessionVars,
                        'lifespanCount': 50,
                        'parameters': {
                            'time': timeString,
                            'date': dateString
                        }
                    }]
                };
            }
        }
    }
    return responseText;
};

// Insert the invent to the calender
const addEventInCalender = async (req) => {

    let outString;
    let responseText = {};

    let outputContexts = req['body']['queryResult']['outputContexts'];
    let name, number, time, date, facebookID;

    outputContexts.forEach(outputContext => {
        let session = outputContext['name'];
        if (session.includes('/contexts/sessionvars')) {
            name = outputContext['parameters']['given-name']['name'];
            number = outputContext['parameters']['phone-number'];
            time = outputContext['parameters']['time'];
            date = outputContext['parameters']['date'];
        }
        if (session.includes('/contexts/generic')) {
            facebookID = outputContext['parameters']['facebook_sender_id'];
        }
    });

    let calenderDates = dateTimeForCalander(date, time);

    let appointmentTimeString = dateTimeToString(date, time);

    let event = {
        'summary': `Appointment for ${name}.`,
        'description': `Customer mobile number ${number}.`,
        'start': {
            'dateTime': calenderDates['start'],
            'timeZone': TIMEZONE
        },
        'end': {
            'dateTime': calenderDates['end'],
            'timeZone': TIMEZONE
        }
    };

    // Insert the data to Google Calender
    let flag = await gc.insertEvent(event);

    let fields = {
        'Name': name,
        'Mobile Number': number,
        'Appointment Date': date.split('T')[0],
        'Appointment Time': time.split('T')[1].substring(0, 5),
        'FacebookID': facebookID
    }
    // Insert the data to the Airtable
    let atflag = await ad.insertAppointment(fields);

    // Reset all the context
    let session = req['body']['session'];
    let awaitName = `${session}/contexts/await-number`;
    let sessionVars = `${session}/contexts/sessionvars`;

    if (flag == 1 && atflag == 1) {
        outString = `Appointment is set for ${appointmentTimeString}.`;
        responseText = {
            'fulfillmentText': outString,
            'outputContexts': [{
                'name': awaitName,
                'lifespanCount': 0
            }, {
                'name': sessionVars,
                'lifespanCount': 0,
            }]
        };
    } else {
        outString = 'An error occured, please try again after some time.';
        responseText = {
            'fulfillmentText': outString,
            'outputContexts': [{
                'name': awaitName,
                'lifespanCount': 0
            }, {
                'name': sessionVars,
                'lifespanCount': 0,
            }]
        };
    }

    return responseText;
};

// When user chooses the time slots provided by us
const rescheduleAppointment = async (req) => {

    let timeString = req['body']['queryResult']['parameters']['reTime'];

    outString = `What first name I use to book the appointment?`;
    
    let session = req['body']['session'];
    let sessionVars = `${session}/contexts/sessionvars`;

    responseText = {
        'fulfillmentText': outString,
        'outputContexts': [{
            'name': `${session}/contexts/await-name`,
            'lifespanCount': 1
        }, {
            'name': sessionVars,
            'lifespanCount': 50,
            'parameters': {
                'time': timeString,
            }
        }]
    };

    return responseText;
}

router.post('/', async (req, res) => {

    let action = req['body']['queryResult']['action'];
    let responseText = {};
    if (action === 'schedule-appointment') {
        responseText = await scheduleAppointment(req);
    } else if (action === 'user-number-entered') {
        responseText = await addEventInCalender(req);
    } else if (action === 'reschedule-appointment') {
        responseText = await rescheduleAppointment(req);
    }

    res.send(responseText);
});

module.exports = {
    router
};
