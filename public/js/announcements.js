// ฟังก์ชันสำหรับแก้ไขประกาศ
async function editAnnouncement(id) {
  try {
    const response = await fetch(`/api/announcements/${id}`);
    const announcement = await response.json();
    
    // เติมข้อมูลในฟอร์ม
    document.getElementById('announcementId').value = announcement.id;
    document.getElementById('announcementTitle').value = announcement.title;
    document.getElementById('announcementContent').value = announcement.content;
    document.getElementById('announcementCategory').value = announcement.category;
    
    // เปลี่ยนหัวข้อ modal
    document.querySelector('#announcementModal .modal-title').textContent = 'แก้ไขประกาศ';
    
    // แสดง modal
    const modal = new bootstrap.Modal(document.getElementById('announcementModal'));
    modal.show();
  } catch (error) {
    console.error('Error:', error);
    alert('เกิดข้อผิดพลาดในการดึงข้อมูลประกาศ');
  }
}

// ฟังก์ชันสำหรับลบประกาศ
async function deleteAnnouncement(id) {
  if (confirm('คุณแน่ใจหรือไม่ที่จะลบประกาศนี้?')) {
    try {
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // ลบประกาศออกจากหน้าเว็บ
        const announcement = document.querySelector(`[data-announcement-id="${id}"]`);
        announcement.remove();
      } else {
        throw new Error('Failed to delete announcement');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('เกิดข้อผิดพลาดในการลบประกาศ');
    }
  }
}

// Event listener สำหรับบันทึกประกาศ
document.getElementById('saveAnnouncement').addEventListener('click', async function() {
  const form = document.getElementById('announcementForm');
  const formData = new FormData(form);
  const announcementId = document.getElementById('announcementId').value;
  
  try {
    const response = await fetch(`/api/announcements${announcementId ? `/${announcementId}` : ''}`, {
      method: announcementId ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: formData.get('announcementTitle'),
        content: formData.get('announcementContent'),
        category: formData.get('announcementCategory')
      })
    });
    
    if (response.ok) {
      // รีโหลดหน้าเว็บเพื่อแสดงข้อมูลใหม่
      window.location.reload();
    } else {
      throw new Error('Failed to save announcement');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('เกิดข้อผิดพลาดในการบันทึกประกาศ');
  }
}); 