// ฟังก์ชันสำหรับแก้ไขกิจกรรม
async function editEvent(id) {
  try {
    const response = await fetch(`/api/events/${id}`);
    const event = await response.json();
    
    // เติมข้อมูลในฟอร์ม
    document.getElementById('eventId').value = event.id;
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventDescription').value = event.description;
    document.getElementById('eventStart').value = event.start_datetime.slice(0, 16);
    document.getElementById('eventEnd').value = event.end_datetime.slice(0, 16);
    document.getElementById('eventLocation').value = event.location;
    document.getElementById('eventMaxParticipants').value = event.max_participants || '';
    
    // เปลี่ยนหัวข้อ modal
    document.querySelector('#eventModal .modal-title').textContent = 'แก้ไขกิจกรรม';
    
    // แสดง modal
    const modal = new bootstrap.Modal(document.getElementById('eventModal'));
    modal.show();
  } catch (error) {
    console.error('Error:', error);
    alert('เกิดข้อผิดพลาดในการดึงข้อมูลกิจกรรม');
  }
}

// ฟังก์ชันสำหรับลบกิจกรรม
async function deleteEvent(id) {
  if (confirm('คุณแน่ใจหรือไม่ที่จะลบกิจกรรมนี้?')) {
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // ลบกิจกรรมออกจากหน้าเว็บ
        const event = document.querySelector(`[data-event-id="${id}"]`);
        event.remove();
      } else {
        throw new Error('Failed to delete event');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('เกิดข้อผิดพลาดในการลบกิจกรรม');
    }
  }
}

// ฟังก์ชันสำหรับเข้าร่วมกิจกรรม
async function joinEvent(id) {
  try {
    const response = await fetch(`/api/events/${id}/join`, {
      method: 'POST'
    });
    
    if (response.ok) {
      // อัพเดทสถานะปุ่มและจำนวนผู้เข้าร่วม
      const button = document.querySelector(`[data-event-id="${id}"] .join-event-btn`);
      button.textContent = 'ยกเลิกการเข้าร่วม';
      button.classList.remove('btn-outline-primary');
      button.classList.add('btn-danger');
      
      const badge = document.querySelector(`[data-event-id="${id}"] .participants-badge`);
      const currentCount = parseInt(badge.textContent.split('/')[0]);
      badge.textContent = `${currentCount + 1}/${badge.textContent.split('/')[1]}`;
    } else {
      throw new Error('Failed to join event');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('เกิดข้อผิดพลาดในการเข้าร่วมกิจกรรม');
  }
}

// Event listener สำหรับบันทึกกิจกรรม
document.getElementById('saveEvent').addEventListener('click', async function() {
  const form = document.getElementById('eventForm');
  const formData = new FormData(form);
  const eventId = document.getElementById('eventId').value;
  
  try {
    const response = await fetch(`/api/events${eventId ? `/${eventId}` : ''}`, {
      method: eventId ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: formData.get('eventTitle'),
        description: formData.get('eventDescription'),
        start_datetime: formData.get('eventStart'),
        end_datetime: formData.get('eventEnd'),
        location: formData.get('eventLocation'),
        max_participants: formData.get('eventMaxParticipants') || null
      })
    });
    
    if (response.ok) {
      // รีโหลดหน้าเว็บเพื่อแสดงข้อมูลใหม่
      window.location.reload();
    } else {
      throw new Error('Failed to save event');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('เกิดข้อผิดพลาดในการบันทึกกิจกรรม');
  }
}); 