import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Clock, UserX } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export default function AttendanceChecker() {
  const [swipedOnData, setSwipedOnData] = useState(null);
  const [masterData, setMasterData] = useState(null);
  const [scheduleData, setScheduleData] = useState(null);
  const [ptoData, setPtoData] = useState(null);
  const [checkDate, setCheckDate] = useState('2025-10-09');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [xmlInput, setXmlInput] = useState('');
  const [loadingStorage, setLoadingStorage] = useState(true);

  // Load saved data on startup
  React.useEffect(() => {
    const loadSavedData = () => {
      try {
        // Load master staff data from localStorage
        const masterSaved = localStorage.getItem('master-staff-data');
        if (masterSaved) {
          const data = JSON.parse(masterSaved);
          setMasterData(data);
          console.log('Loaded saved master data:', data.length, 'records');
        }

        // Load schedule data from localStorage
        const scheduleSaved = localStorage.getItem('schedule-data');
        if (scheduleSaved) {
          const data = JSON.parse(scheduleSaved);
          setScheduleData(data);
          console.log('Loaded saved schedule data:', data.length, 'records');
        }
      } catch (err) {
        console.log('No saved data found or error loading:', err);
      } finally {
        setLoadingStorage(false);
      }
    };
    
    loadSavedData();
  }, []);

  const saveMasterData = () => {
    if (!masterData) {
      alert('No master data to save');
      return;
    }
    try {
      localStorage.setItem('master-staff-data', JSON.stringify(masterData));
      alert(`Saved ${masterData.length} staff records! This data will auto-load next time.`);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  };

  const saveScheduleData = () => {
    if (!scheduleData) {
      alert('No schedule data to save');
      return;
    }
    try {
      localStorage.setItem('schedule-data', JSON.stringify(scheduleData));
      alert(`Saved ${scheduleData.length} schedule records! This data will auto-load next time.`);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  };

  const parseFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      return new Promise((resolve) => {
        Papa.parse(file, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data)
        });
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return XLSX.utils.sheet_to_json(sheet);
    }
  };

  const parsePTOFromXML = () => {
    try {
      let cleanXML = xmlInput.trim();
      if (!cleanXML.startsWith('<?xml')) {
        const xmlStart = cleanXML.indexOf('<?xml');
        if (xmlStart > -1) cleanXML = cleanXML.substring(xmlStart);
      }
      const parser = new DOMParser();
      const xml = parser.parseFromString(cleanXML, 'application/xml');
      const parserError = xml.getElementsByTagName('parsererror');
      if (parserError.length > 0) {
        alert('XML parsing failed. Use "View Page Source" to copy raw XML.');
        return;
      }
      const requests = xml.getElementsByTagName('Request');
      const ptoList = [];
      for (let i = 0; i < requests.length; i++) {
        const req = requests[i];
        const status = req.getAttribute('Status');
        if (status === 'Approved') {
          const dateOff = req.getElementsByTagName('TimeOffDate')[0]?.textContent;
          const firstName = req.getElementsByTagName('Firstname')[0]?.textContent;
          const lastName = req.getElementsByTagName('Lastname')[0]?.textContent;
          if (firstName && lastName && dateOff) {
            ptoList.push({
              'First Name': firstName.trim(),
              'Last Name': lastName.trim(),
              'Date': dateOff.trim(),
              'Status': status
            });
          }
        }
      }
      if (ptoList.length === 0) {
        alert('No PTO records found. Use "View Page Source" to get raw XML.');
        return;
      }
      setPtoData(ptoList);
      setXmlInput('');
      alert(`Loaded ${ptoList.length} PTO records`);
    } catch (err) {
      alert('Failed to parse XML: ' + err.message);
    }
  };

  const lookupSchedule = () => {
    if (!searchName.trim()) {
      alert('Please enter a name');
      return;
    }
    
    // Debug: log schedule data structure
    if (scheduleData && scheduleData.length > 0) {
      console.log('Schedule data loaded:', scheduleData.length, 'records');
      console.log('First schedule record:', scheduleData[0]);
      console.log('Column names:', Object.keys(scheduleData[0]));
    } else {
      console.log('No schedule data loaded');
    }
    
    const results = [];
    if (masterData) {
      const found = masterData.filter(person => {
        const fullName = `${person['First Name'] || ''} ${person['Last Name'] || ''}`.toLowerCase();
        return fullName.includes(searchName.toLowerCase());
      });
      
      console.log('Found', found.length, 'matching people in master data');
      
      found.forEach(person => {
        const fullName = `${person['First Name']} ${person['Last Name']}`;
        const dept = person.Department || '';
        const deptLower = dept.toLowerCase();
        
        let schedule = null;
        
        // Check if they're in the schedule data
        if (scheduleData) {
          const scheduleRecord = scheduleData.find(s => {
            // Handle both proper column names and generic _1, _2, _3 parsing
            const sFirstName = (s['First Name'] || s._1 || s['_1'] || '').toLowerCase().trim();
            const sLastName = (s['Last Name'] || s._2 || s['_2'] || '').toLowerCase().trim();
            const pFirstName = (person['First Name'] || '').toLowerCase().trim();
            const pLastName = (person['Last Name'] || '').toLowerCase().trim();
            
            // Skip header rows
            if (sFirstName === 'first name' || sFirstName === 'firstname') return false;
            
            const match = sFirstName === pFirstName && sLastName === pLastName;
            
            if (pFirstName === 'steve') {
              console.log('Checking Steve:', {
                scheduleFirstName: sFirstName,
                scheduleLastName: sLastName,
                personFirstName: pFirstName,
                personLastName: pLastName,
                match: match
              });
            }
            
            return match;
          });
          
          if (scheduleRecord) {
            const scheduleValue = scheduleRecord.Schedule || scheduleRecord._3 || scheduleRecord['_3'] || '';
            if (scheduleValue && scheduleValue.toLowerCase() !== 'schedule') {
              console.log('Found schedule for', fullName, ':', scheduleValue);
              schedule = scheduleValue;
            }
          }
        }
        
        // If not in schedule data, use department-based defaults
        if (!schedule) {
          const isInstructional = deptLower.includes('instructional') || 
                                 deptLower.includes('support services') ||
                                 deptLower.includes('curriculum') ||
                                 deptLower.includes('counseling');
          schedule = isInstructional ? '7:50 AM - 3:50 PM (Instructional)' : '8:30 AM - 4:30 PM (Non-Instructional)';
          console.log('Using default schedule for', fullName);
        }
        
        results.push({
          name: fullName,
          title: person['Job Title Description'] || '',
          department: dept,
          location: person['School Location'] || '',
          schedule: schedule
        });
      });
    }
    setScheduleInfo(results);
  };

  const analyzeAttendance = () => {
    if (!swipedOnData || !masterData) {
      alert('Please upload SwipedOn data and Master Staff List');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      try {
        const ptoList = ptoData ? ptoData.map(p => 
          `${(p['First Name'] || '').trim()} ${(p['Last Name'] || '').trim()}`.toLowerCase()
        ).filter(n => n) : [];
        const signedInToday = new Set();
        const lateList = [];
        const onTimeList = [];
        for (const row of swipedOnData) {
          const fname = (row['First Name'] || '').trim();
          const lname = (row['Last Name'] || '').trim();
          const dateIn = row['Date In'];
          const timeIn = row['In'];
          if (!fname || !lname || !dateIn || !timeIn) continue;
          const rowDate = dateIn.toString().trim();
          if (rowDate !== checkDate) continue;
          const fullName = `${fname} ${lname}`;
          signedInToday.add(fullName.toLowerCase());
          const timeParts = timeIn.toString().match(/(\d+):(\d+):(\d+)/);
          if (!timeParts) continue;
          const hours = parseInt(timeParts[1]);
          const minutes = parseInt(timeParts[2]);
          const timeInMinutes = hours * 60 + minutes;
          const masterRecord = masterData.find(m => {
            const mf = (m['First Name'] || '').trim().toLowerCase();
            const ml = (m['Last Name'] || '').trim().toLowerCase();
            return mf === fname.toLowerCase() && ml === lname.toLowerCase();
          });
          if (!masterRecord) continue;
          const dept = (masterRecord.Department || '').toLowerCase();
          const isInstructional = dept.includes('instructional') || 
                                 dept.includes('support services') ||
                                 dept.includes('curriculum') ||
                                 dept.includes('counseling');
          const expectedMinutes = isInstructional ? 470 : 510;
          if (timeInMinutes > expectedMinutes) {
            const late = timeInMinutes - expectedMinutes;
            lateList.push({
              name: fullName,
              signInTime: `${hours}:${minutes.toString().padStart(2,'0')}`,
              expectedTime: isInstructional ? '7:50 AM' : '8:30 AM',
              minutesLate: late,
              department: masterRecord.Department || '',
              title: masterRecord['Job Title Description'] || ''
            });
          } else {
            onTimeList.push(fullName);
          }
        }
        const noSignInList = [];
        masterData.forEach(person => {
          const fname = (person['First Name'] || '').trim();
          const lname = (person['Last Name'] || '').trim();
          if (!fname || !lname) return;
          const fullName = `${fname} ${lname}`;
          const status = (person.Status || '').toLowerCase();
          const isActive = status.includes('existing') || status.includes('new hire');
          if (!isActive) return;
          const nameLower = fullName.toLowerCase();
          const signedIn = signedInToday.has(nameLower);
          const onPTO = ptoList.includes(nameLower);
          if (!signedIn && !onPTO) {
            noSignInList.push({
              name: fullName,
              department: person.Department || '',
              title: person['Job Title Description'] || '',
              location: person['School Location'] || ''
            });
          }
        });
        setResults({
          late: lateList.sort((a, b) => b.minutesLate - a.minutesLate),
          noSignIn: noSignInList.sort((a, b) => a.name.localeCompare(b.name)),
          onTime: onTimeList.length,
          totalSignedIn: signedInToday.size,
          ptoCount: ptoList.length
        });
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">Daily Attendance Checker</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Check Date</label>
              <input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">SwipedOn Export</label>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={async (e) => { const data = await parseFile(e.target.files[0]); setSwipedOnData(data); }} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              {swipedOnData && <span className="text-green-600 text-sm mt-1 block">✓ {swipedOnData.length} records</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Master Staff Report</label>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={async (e) => { const data = await parseFile(e.target.files[0]); setMasterData(data); }} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              {masterData && <span className="text-green-600 text-sm mt-1 block">✓ {masterData.length} staff</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Employee Schedules (Optional)</label>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={async (e) => { const data = await parseFile(e.target.files[0]); setScheduleData(data); }} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              {scheduleData && <span className="text-green-600 text-sm mt-1 block">✓ Loaded</span>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-2">PTO Data</label>
              <div className="flex gap-2 mb-2">
                <input type="file" accept=".csv,.xlsx,.xls" onChange={async (e) => { const data = await parseFile(e.target.files[0]); setPtoData(data); }} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex gap-2">
                <textarea value={xmlInput} onChange={(e) => setXmlInput(e.target.value)} placeholder="Or paste PurelyHR XML (View Page Source)" className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm h-20 font-mono text-xs" />
                <button onClick={parsePTOFromXML} disabled={!xmlInput.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 text-sm">Parse XML</button>
              </div>
              {ptoData && <span className="text-green-600 text-sm mt-1 block">✓ {ptoData.length} PTO records</span>}
            </div>
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Lookup</label>
              <div className="flex gap-2">
                <input type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Enter employee name..." className="flex-1 px-4 py-2 border border-gray-300 rounded-lg" onKeyPress={(e) => e.key === 'Enter' && lookupSchedule()} />
                <button onClick={lookupSchedule} disabled={!masterData} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400">Look Up</button>
              </div>
            </div>
          </div>
          {scheduleInfo && scheduleInfo.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Schedule Information</h3>
              <div className="space-y-3">
                {scheduleInfo.map((person, i) => (
                  <div key={i} className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="font-bold text-lg">{person.name}</div>
                    <div className="text-sm text-gray-600">{person.title}</div>
                    <div className="text-sm text-gray-600">{person.department} • {person.location}</div>
                    <div className="text-lg font-semibold text-blue-600 mt-2">{person.schedule}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={analyzeAttendance} disabled={!swipedOnData || !masterData || loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400">{loading ? 'Analyzing...' : 'Check Attendance'}</button>
          {results && (
            <div className="mt-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><AlertCircle className="text-red-600" size={20} /><h3 className="font-bold text-red-900">Late</h3></div>
                  <p className="text-3xl font-bold text-red-600">{results.late.length}</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><UserX className="text-orange-600" size={20} /><h3 className="font-bold text-orange-900">No Sign-In</h3></div>
                  <p className="text-3xl font-bold text-orange-600">{results.noSignIn.length}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><CheckCircle className="text-green-600" size={20} /><h3 className="font-bold text-green-900">On Time</h3></div>
                  <p className="text-3xl font-bold text-green-600">{results.onTime}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><Clock className="text-blue-600" size={20} /><h3 className="font-bold text-blue-900">Total Signed In</h3></div>
                  <p className="text-3xl font-bold text-blue-600">{results.totalSignedIn}</p>
                </div>
              </div>
              {results.late.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Late Arrivals</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="border-b"><th className="text-left py-2 px-2">Name</th><th className="text-left py-2 px-2">Title</th><th className="text-left py-2 px-2">Signed In</th><th className="text-left py-2 px-2">Expected</th><th className="text-left py-2 px-2">Late By</th><th className="text-left py-2 px-2">Department</th></tr></thead>
                      <tbody>{results.late.map((person, i) => (<tr key={i} className="border-b hover:bg-gray-50"><td className="py-2 px-2 font-medium">{person.name}</td><td className="py-2 px-2 text-sm">{person.title}</td><td className="py-2 px-2">{person.signInTime}</td><td className="py-2 px-2">{person.expectedTime}</td><td className="py-2 px-2 text-red-600 font-semibold">{person.minutesLate} min</td><td className="py-2 px-2 text-sm">{person.department}</td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {results.noSignIn.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Did Not Sign In</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="border-b"><th className="text-left py-2 px-2">Name</th><th className="text-left py-2 px-2">Title</th><th className="text-left py-2 px-2">Department</th><th className="text-left py-2 px-2">Location</th></tr></thead>
                      <tbody>{results.noSignIn.map((person, i) => (<tr key={i} className="border-b hover:bg-gray-50"><td className="py-2 px-2 font-medium">{person.name}</td><td className="py-2 px-2 text-sm">{person.title}</td><td className="py-2 px-2 text-sm">{person.department}</td><td className="py-2 px-2 text-sm">{person.location}</td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

